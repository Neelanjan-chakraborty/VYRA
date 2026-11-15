// Measures the Rust realtime gateway: delivery latency from an API publish on
// Redis to the app's socket, and the gateway's memory per connection.
// Development database and Redis only. Needs the gateway running (pnpm dev:realtime).
// Usage: node scripts/bench-realtime.mjs [connections=500] [events=200]
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { SignJWT } = require('jose');
const { Redis } = require('ioredis');
const { decode, encode } = createRequire(new URL('../apps/mobile/package.json', import.meta.url))(
  '@msgpack/msgpack',
);

const CONNECTIONS = Number(process.argv[2] ?? 500);
const EVENTS = Number(process.argv[3] ?? 200);
const env = Object.fromEntries(
  readFileSync(new URL('../apps/api/.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => /^\w+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
);
const psql = (sql) =>
  execFileSync('psql', [env.DATABASE_URL.split('?')[0], '-tAc', sql])
    .toString()
    .trim();

const gatewayPid = execFileSync('pgrep', ['-f', 'vyra-realtime']).toString().trim().split('\n')[0];
const rssKb = () =>
  Number(/VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${gatewayPid}/status`, 'utf8'))?.[1] ?? 0);

// A throwaway session for an existing active user, removed at the end.
const userId = psql("select id from users where status = 'ACTIVE' limit 1");
const sessionId = randomUUID();
psql(
  `insert into auth_sessions (id, user_id, refresh_token_hash, expires_at) values ('${sessionId}', '${userId}', '${randomBytes(32).toString('hex')}', now() + interval '1 hour')`,
);
const token = await new SignJWT({ sid: sessionId })
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject(userId)
  .setIssuer('vyra-api')
  .setAudience('vyra:access')
  .setIssuedAt()
  .setExpirationTime('10m')
  .sign(new TextEncoder().encode(env.JWT_ACCESS_SECRET));

const before = rssKb();
const latencies = [];
const sockets = [];
let received = 0;
await Promise.all(
  Array.from(
    { length: CONNECTIONS },
    () =>
      new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:4001/v1/realtime');
        ws.binaryType = 'arraybuffer';
        ws.addEventListener('open', () => ws.send(encode({ t: 'auth', token })));
        ws.addEventListener('message', (event) => {
          const frame = decode(new Uint8Array(event.data));
          if (frame.t === 'ready') resolve();
          if (frame.t === 'event' && frame.e === 'bench') {
            latencies.push(performance.timeOrigin + performance.now() - frame.d.sentAt);
            received += 1;
          }
        });
        ws.addEventListener('close', (event) => reject(new Error(`closed ${event.code}`)));
        sockets.push(ws);
      }),
  ),
);
await new Promise((r) => setTimeout(r, 500));
const connected = rssKb();

const redis = new Redis(env.REDIS_URL);
for (let i = 0; i < EVENTS; i += 1) {
  await redis.publish(
    'vyra:realtime',
    JSON.stringify({
      userIds: [userId],
      event: 'bench',
      payload: { sentAt: performance.timeOrigin + performance.now() },
    }),
  );
  await new Promise((r) => setTimeout(r, 5));
}
// Wait (up to 5 s) for every delivery; `received` is updated by the socket handlers.
const expected = CONNECTIONS * EVENTS;
for (const deadline = Date.now() + 5000; Date.now() < deadline;) {
  if (received >= expected) break;
  await new Promise((r) => setTimeout(r, 50));
}

latencies.sort((a, b) => a - b);
const pct = (p) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))];
console.log(`${CONNECTIONS} connections, ${EVENTS} events → ${received} deliveries`);
console.log(
  `latency publish→socket: p50 ${pct(0.5).toFixed(2)} ms, p95 ${pct(0.95).toFixed(2)} ms, p99 ${pct(0.99).toFixed(2)} ms`,
);
console.log(
  `gateway RSS: ${(before / 1024).toFixed(1)} MB idle → ${(connected / 1024).toFixed(1)} MB with ${CONNECTIONS} connections (~${((connected - before) / CONNECTIONS).toFixed(1)} KB each)`,
);

for (const ws of sockets) ws.close();
await redis.quit();
psql(`delete from auth_sessions where id = '${sessionId}'`);
