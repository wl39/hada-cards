import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
// Only the current Codespace hostname is allowed; keep Vite's host check enabled.
const codespace = process.env.CODESPACE_NAME;
const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
const forwardedHost = codespace && forwardingDomain ? `${codespace}-5180.${forwardingDomain}` : undefined;
export default defineConfig({
  server: { port: 5180, strictPort: true, allowedHosts: forwardedHost ? [forwardedHost] : [] },
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: process.env.STUDIO_BASE_PATH || './',
  build: { outDir: '../studio-dist', emptyOutDir: true, sourcemap: false },
});
