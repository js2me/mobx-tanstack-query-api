import { defineLibViteConfig } from "sborshik/vite";
import { ConfigsManager } from "sborshik/utils";
 
export default defineLibViteConfig(ConfigsManager.create(), {
  binPath: './cli.js',
  externalDeps: [
    'node:url',
    'node:path'
  ]
}) 
