import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

// Also accepts HADA's composed shader entry to validate its licensed extensions.
const source = process.argv[2] ? pathToFileURL(resolve(process.argv[2])) : new URL('../dist/shaders.js', import.meta.url);
const { vertexSource, fragmentSource } = await import(source.href);
const directory = mkdtempSync(join(tmpdir(), 'hada-shaders-'));
try {
  const vertex = join(directory, 'card.vert'), fragment = join(directory, 'card.frag');
  writeFileSync(vertex, '#version 100\n' + vertexSource);
  writeFileSync(fragment, '#version 100\n' + fragmentSource);
  const result = spawnSync('glslangValidator', ['-l', vertex, fragment], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
  console.log('GLSL ES 1.00 vertex/fragment compile and link passed');
} finally { rmSync(directory, { recursive: true, force: true }); }
