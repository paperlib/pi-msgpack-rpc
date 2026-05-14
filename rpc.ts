
import * as net from 'node:net';
import { inspect } from 'node:util';
import { pipeline } from 'node:stream';

import { pack, UnpackrStream } from 'msgpackr';

export async function msgpackRpcCall(
    server: string, method: string, args : any[] = [],
    timeout = 30000, ctx?: any
  ) {
  return new Promise((resolve, reject) => {
    const unpackStream = new UnpackrStream();

    const client = net.createConnection(server, () => {
      if (ctx) ctx.ui.notify(`[pi-msgpack-rpc rpc] connected to ${server}, calling ${method}`, "info");
      client.write(pack([0, Date.now() % 1000000, method, args]));
    })

    pipeline(client, unpackStream, (err) => {
      if (err && ctx) ctx.ui.notify(`[pi-msgpack-rpc rpc] pipeline error: ${err.message}`, "error");
    });

    unpackStream.on('data', (msg: any) => {
      if (ctx) ctx.ui.notify(`[pi-msgpack-rpc rpc] response received`, "success");
      client.end();

      if (Array.isArray(msg) && msg[0] === 1) {
        const error = msg[2]; const result = safe(msg[3]);
        error !== null && error !== undefined ? reject(error) : resolve(result);
      } else {
        resolve(msg);
      }
    });
  });
}

function safe(value: any): string {
  if (typeof value === 'string') return value;
  if (value == null) return String(value);

  // -- note: JSON.stringify is unable to stringify whole Object structures
  // -- in some cases. In particular the result Object of "nvim_get_api_info"
  return inspect(value, {
    depth: null,
    colors: false,
    compact: true,
    maxArrayLength: null,
    maxStringLength: null,
  });
}
