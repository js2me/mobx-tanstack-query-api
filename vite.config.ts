import { defineLibViteConfig } from "sborshik/vite";
import { ConfigsManager } from "sborshik/utils";
 
export default defineLibViteConfig(ConfigsManager.create(), {
  binPath: './bin.js',
  externalDeps: [
    'node:url',
    'node:path',
    'node:fs'
  ]
}) 
