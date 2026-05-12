
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { msgpackRpcCall } from "./rpc";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "msgpack_rpc_call",
    label: "MessagePack RPC Call",
    description: "A Generic MessagePack RPC Calls Interface",
    parameters: Type.Object({
      server: Type.String({ description: "An RPC socket path (eg. Neovim's RPC API socket path" }),
      method: Type.String({ description: "Any RPC API methods, for example Neovim's nvim_get_api_info" }),
      params: Type.Array(Type.Any(), { default: [] }),
      timeout: Type.Optional(Type.Number({ default: 10000 })),
    }),
    async execute(toolCallId, parameters, signal, onUpdate, ctx) {
      ctx.ui.notify(`[pi-msgpack-rpc tool] rpc_call invoked with: ${JSON.stringify(parameters)}`, "info");
      const { server, method, params = [], timeout = 10000 } = parameters || {};

      if (!server || !method) {
        ctx.ui.notify(`[pi-msgpack-rpc tool] missing server or method`, "error");
        throw new Error("server and method are required");
      }

      ctx.ui.notify(`[pi-msgpack-rpc tool] calling ${server} → ${method}`, "info");
      const result = await msgpackRpcCall(server, method, params, timeout, ctx);

      return {
        content: [{ type: "text", text: result }],
        details: { raw: result }
      };
    },
  });

  pi.events.on("msgpack:rpc:call", async (payload: any, ctx?: any) => {
    ctx?.ui?.notify?.(`[pi-msgpack-rpc events] received: ${payload}`, "info");
    const { server, method, params = [], timeout = 10000, correlationId, replyEvent } = payload || {};

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
