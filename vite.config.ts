import { ConfigsManager } from 'sborshik/utils';
import { defineLibViteConfig } from 'sborshik/vite';

export default defineLibViteConfig(ConfigsManager.create(), {
  binPath: './bin.js',
  externalDeps: ['node:url', 'node:path', 'node:fs'],
});
