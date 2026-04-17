import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const INPUT_FILE = path.resolve(
  __dirname,
  './operation-servers-override.openapi.yaml',
);
const OUTPUT_DIR = path.resolve(
  __dirname,
  './__generated__/operation-servers-override',
);
const ENDPOINT_FILE = path.resolve(
  OUTPUT_DIR,
  'endpoints',
  'get-operation-servers-override.ts',
);

describe('generateApi operation-level servers override', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });

  it('uses last url from operation.servers, not from global servers', async () => {
    await generateApi(
      defineConfig({
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
        filterEndpoints: [/^getOperationServersOverride$/i],
      }),
    );

    const content = await fs.readFile(ENDPOINT_FILE, 'utf-8');
    expect(content.replaceAll('\r\n', '\n')).toMatchSnapshot();
  });
});
