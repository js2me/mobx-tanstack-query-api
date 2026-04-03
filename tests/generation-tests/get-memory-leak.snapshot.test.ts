import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const INPUT_FILE = path.resolve(__dirname, './get-memory-leak.swagger2.json');
const OUTPUT_DIR = path.resolve(__dirname, './__generated__/memory-leak');
const ENDPOINT_FILE = path.resolve(
  OUTPUT_DIR,
  'endpoints',
  'get-memory-leak.ts',
);

describe('generateApi snapshot getMemoryLeak', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    // swagger-typescript-api fileSystem.createDir does not create nested dirs recursively,
    // so ensure parent (__generated__) exists
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });

  it('generates endpoint matching snapshot', async () => {
    await generateApi(
      defineConfig({
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
        filterEndpoints: [/^getMemoryLeak$/i],
      }),
    );

    const content = await fs.readFile(ENDPOINT_FILE, 'utf-8');
    expect(content.replaceAll('\r\n', '\n')).toMatchSnapshot();
  });
});

