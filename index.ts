
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { msgpackRpcCall } from "./rpc";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "msgpack_rpc_call",
    label: "MessagePack RPC Call",
    description: "Generic MessagePack RPC Calls Interface",
    parameters: Type.Object({
      server: Type.String({ description: "Neovim RPC socket path (eg. :echo v:servername in Neovim" }),
      method: Type.String({ description: "Any of Neovim's RPC API methods, e.g. nvim_get_api_info" }),
      params: Type.Array(Type.Any(), { default: [] }),
      timeout: Type.Optional(Type.Number({ default: 5000 })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      ctx.ui.notify(`[pi-msgpack-rpc tool] rpc_call invoked with: ${JSON.stringify(params)}`, "info");

      const server  = params?.server;
      const method  = params?.method;
      const args    = Array.isArray(params?.params) ? params.params : [];
      const timeout = params?.timeout;

      if (!server || !method) {
        ctx.ui.notify(`[pi-msgpack-rpc tool] missing server or method`, "error");
        throw new Error("server and method are required");
      }

      ctx.ui.notify(`[pi-msgpack-rpc tool] calling ${server} → ${method}`, "info");

      const result = await msgpackRpcCall(server, method, args, timeout, ctx);

      return {
        content: [{ type: "text", text: result }],
        details: { raw: result }
      };
    },
  });

  pi.events.on("msgpack:rpc:call", async (payload: any, ctx?: any) => {
    ctx?.ui?.notify?.(`[pi-msgpack-rpc events] received: ${payload}`, "info");
    const { server, method, params = [], timeout = 20000, correlationId, replyEvent } = payload || {};

    if (!server || !method || !correlationId) {
      pi.events.emit("msgpack:rpc:response", { correlationId, success: false, error: "Missing required fields" });
      return;
    }

    try {
      const result = await msgpackRpcCall(server, method, params, timeout, ctx);
      pi.events.emit(replyEvent, { success: true, result });
    } catch (err: any) {
      pi.events.emit(replyEvent, { success: false, error: err.message });
    }
  });
}
