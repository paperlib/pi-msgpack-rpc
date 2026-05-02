
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

import * as net from 'node:net';
import { pipeline } from 'node:stream';
import { pack, UnpackrStream } from 'msgpackr';


export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("pi-msgpack-rpc extension loaded!", "info");
  });

  pi.registerTool({
    name: "msgpack_rpc_call",
    label: "MessagePack RPC Call",
    description: "Generic MessagePack RPC call (based on your working talk.ts script)",
    parameters: Type.Object({
      server: Type.String({ description: "Exact socket path from :echo v:servername inside Neovim" }),
      method: Type.String({ description: "e.g. nvim_get_api_info" }),
      params: Type.Array(Type.Any(), { default: [] }),
      timeout: Type.Optional(Type.Number({ default: 5000 })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      ctx.ui.notify(`[Tool] msgpack_rpc_call invoked with params: ${JSON.stringify(params)}`, "info");

      const server  = params?.server;
      const method  = params?.method;
      const args    = Array.isArray(params?.params) ? params.params : [];
      const timeout = params?.timeout;

      if (!server || !method) {
        ctx.ui.notify(`[Tool] Missing server or method`, "error");
        throw new Error("server and method are required");
      }

      ctx.ui.notify(`[RPC] Starting call to ${server} → ${method}`, "info");

      const unpackStream = new UnpackrStream();

      const result = await new Promise((resolve, reject) => {
        const client = net.createConnection(server, () => {
          ctx.ui.notify(`[RPC] Connected to Neovim ${server}, calling ${method}`, "info");
          client.write(pack([0, Date.now() % 1000000, method, args]));
        })

        pipeline(client, unpackStream, (err) => {
          if (err) ctx.ui.notify(`[RPC] Pipeline error: ${err.message}`, "error");
        });

        unpackStream.on('data', (msg: any) => {
          ctx.ui.notify(`[RPC] Received response`, "success");
          client.end();

          if (Array.isArray(msg) && msg[0] === 1) {
            const error = msg[2]; const result = msg[3];
            error !== null && error !== undefined ? reject(error) : resolve(result);
          } else {
            resolve(msg);
          }
        });
      });

      return {
        content: [{ type: "text", text: result }],
        details: { raw: result }
      };
    },
  });
}
