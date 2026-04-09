import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const INPUT_FILE = path.resolve(__dirname, './get-foo-bar.openapi3.json');
const OUTPUT_DIR = path.resolve(__dirname, './__generated__/get-foo-bar');
const ENDPOINT_FILE = path.resolve(OUTPUT_DIR, 'endpoints', 'get-foo-bar.ts');
const DATA_CONTRACTS_FILE = path.resolve(OUTPUT_DIR, 'data-contracts.ts');

describe('generateApi getFooBar OpenAPI 3 (components.schemas.GetFooBarData)', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });

  it('generates endpoint getFooBar and model from schema GetFooBarData', async () => {
    await generateApi(
      defineConfig({
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
      }),
    );

    const endpoint = (await fs.readFile(ENDPOINT_FILE, 'utf-8')).replaceAll(
      '\r\n',
      '\n',
    );
    const dataContracts = (
      await fs.readFile(DATA_CONTRACTS_FILE, 'utf-8')
    ).replaceAll('\r\n', '\n');

    expect(endpoint).toMatchSnapshot();
    expect(dataContracts).toMatchSnapshot();
  });
});
