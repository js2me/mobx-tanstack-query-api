#!/usr/bin/env node

import { existsSync } from 'node:fs';
import path from 'node:path';

import { generateApi, GenerateApiParams } from '../codegen/index.js';

const projectDir = process.cwd();

let generateApiParams: GenerateApiParams;

let module: any;

if (existsSync(path.resolve(projectDir, 'api-codegen.config.js'))) {
  module = await import(path.resolve(projectDir, 'api-codegen.config.js'));
} else if (existsSync(path.resolve(projectDir, 'api-codegen.config.mjs'))) {
  module = await import(path.resolve(projectDir, 'api-codegen.config.mjs'));
} else if (existsSync(path.resolve(projectDir, 'api-codegen.config.json'))) {
  module = await import(path.resolve(projectDir, 'api-codegen.config.json'));
} else {
  throw new Error('api-codegen.config.(js|mjs|json) not found');
}

if (module.default && 'links' in module.default) {
  generateApiParams = module.default;
} else {
  throw new Error('api-codegen.config.(js|mjs|json) is not valid');
}

generateApi(generateApiParams);
