import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  build: { outDir: '../studio-dist', emptyOutDir: true, sourcemap: false },
});
