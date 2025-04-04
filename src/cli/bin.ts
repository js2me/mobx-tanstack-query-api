#!/usr/bin/env node

import { existsSync } from 'node:fs';
import path from 'node:path';

import { generateApi, GenerateQueryApiParams } from '../codegen/index.js';

import { defineConfig } from './define-config.js';

const projectDir = process.cwd();

let generateApiParams: GenerateQueryApiParams[];

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

if (module.default) {
  generateApiParams = module.default;
} else {
  throw new Error(
    'api-codegen.config.(js|mjs|json) is not valid, This file should return object - result of the defineConfig function',
  );
}

defineConfig(generateApiParams).forEach(generateApi);
