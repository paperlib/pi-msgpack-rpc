
import * as net from 'node:net';
import { pipeline } from 'node:stream';
import { pack, UnpackrStream } from 'msgpackr';

export async function msgpackRpcCall(
    server: string,
    method: string,
    args : any[] = [],
    timeout = 30000,
    ctx?: any
  ) {
  return new Promise((resolve, reject) => {
    const unpackStream = new UnpackrStream();

    const client = net.createConnection(server, () => {
      if (ctx) ctx.ui.notify(`[RPC] Connected to ${server}, calling ${method}`, "info");
      client.write(pack([0, Date.now() % 1000000, method, args]));
    })

    pipeline(client, unpackStream, (err) => {
      if (err && ctx) ctx.ui.notify(`[RPC] Pipeline error: ${err.message}`, "error");
    });

    unpackStream.on('data', (msg: any) => {
      if (ctx) ctx.ui.notify(`[RPC] Received response`, "success");
      client.end();

      if (Array.isArray(msg) && msg[0] === 1) {
        const error = msg[2]; const result = msg[3] || "n/a";
        error !== null && error !== undefined ? reject(error) : resolve(result);
      } else {
        resolve(msg);
      }
    });
  });
}

