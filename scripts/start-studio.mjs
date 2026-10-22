import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('..', import.meta.url));
const url = 'http://127.0.0.1:5180/';
const logPath = `${root}/.cache/studio.log`;
async function probe() {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
    if (response.ok && (await response.text()).includes('<title>HADA Card Studio</title>')) return 'ready';
    return 'occupied';
  } catch { return 'missing'; }
}

const existing = await probe();
if (existing === 'occupied') throw new Error('Port 5180 is occupied by another application.');
if (existing === 'ready') {
  console.log(`HADA Card Studio: ${url}`);
} else {
  mkdirSync(`${root}/.cache`, { recursive: true });
  const log = openSync(logPath, 'a');
  const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'studio', '--host',
    process.env.CODESPACES === 'true' ? '0.0.0.0' : '127.0.0.1', '--port', '5180', '--strictPort'], {
    cwd: root, detached: true, stdio: ['ignore', log, log],
  });
  closeSync(log);
  let failure;
  child.on('error', error => { failure = error; });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (failure || child.exitCode !== null || child.signalCode) break;
    if (await probe() === 'ready') { ready = true; break; }
    await delay(150);
  }
  if (!ready) {
    child.kill('SIGTERM');
    throw new Error(`Studio startup failed: ${failure?.message ?? readFileSync(logPath, 'utf8').slice(-2000)}`);
  }
  writeFileSync(`${root}/.cache/studio.pid`, String(child.pid));
  child.unref();
  console.log(`HADA Card Studio: ${url}`);
}
