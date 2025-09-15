import fs, { existsSync } from 'node:fs';
import path from 'node:path';
import type { Maybe } from 'yummies/utils/types';

const projectDir = process.cwd();

export const resolveConfigPath = (userSpefiedPath?: Maybe<string>) => {
  if (userSpefiedPath) {
    const fullUserSpecifiedPath = path.resolve(projectDir, userSpefiedPath);

    if (!fs.existsSync(fullUserSpecifiedPath)) {
      throw `Config file not found by path - ${userSpefiedPath}`;
    }

    return path.resolve(projectDir, userSpefiedPath);
  }

  if (existsSync(path.resolve(projectDir, 'api-codegen.config.js'))) {
    return path.resolve(projectDir, 'api-codegen.config.js');
  } else if (existsSync(path.resolve(projectDir, 'api-codegen.config.mjs'))) {
    return path.resolve(projectDir, 'api-codegen.config.mjs');
  } else if (existsSync(path.resolve(projectDir, 'api-codegen.config.json'))) {
    return path.resolve(projectDir, 'api-codegen.config.json');
  } else if (existsSync(path.resolve(projectDir, 'api-codegen.config.ts'))) {
    return path.resolve(projectDir, 'api-codegen.config.ts');
  }

  throw new Error('api-codegen.config.(js|mjs|json|ts) not found');
};
