// Vitest global setup: builds the Rust realtime gateway and runs it for the
// end-to-end suites, on its own port and with the test Redis namespace.
import 'dotenv/config';
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { resolve } from 'node:path';

export const REALTIME_TEST_PORT = 4101;
const root = resolve(import.meta.dirname, '../../../..');

let gateway: ChildProcess | undefined;

export async function setup(): Promise<void> {
  execFileSync('cargo', ['build', '-q', '-p', 'vyra-realtime'], { cwd: root, stdio: 'inherit' });
  gateway = spawn(resolve(root, 'target/debug/vyra-realtime'), [], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      REALTIME_PORT: String(REALTIME_TEST_PORT),
      RUST_LOG: 'warn',
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  for (let i = 0; i < 100; i += 1) {
    try {
      const response = await fetch(`http://localhost:${REALTIME_TEST_PORT}/health`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('The realtime gateway did not start');
}

export function teardown(): void {
  gateway?.kill('SIGTERM');
}
