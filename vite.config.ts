import { ConfigsManager } from 'sborshik/utils';
import { defineLibViteConfig } from 'sborshik/vite';

export default defineLibViteConfig(ConfigsManager.create(), {
  binPath: './bin.js',
  // Keep Node `fs` out of the browser stub (`__vite_browser_external`) so cli codegen keeps statSync/rmSync.
  externalDeps: ['node:url', 'node:path', 'node:fs', 'fs'],
});
