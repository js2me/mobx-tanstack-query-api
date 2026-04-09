import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const INPUT_FILE = path.resolve(
  __dirname,
  './save-response-data-type-1.swagger2.json',
);
const OUTPUT_DIR = path.resolve(
  __dirname,
  './__generated__/save-response-data-type-1',
);
const ENDPOINT_FILE = path.resolve(
  OUTPUT_DIR,
  'endpoints',
  'save-response-data-type-1.ts',
);
const DATA_CONTRACTS_FILE = path.resolve(OUTPUT_DIR, 'data-contracts.ts');

describe('generateApi saveResponseDataType1 Swagger 2 (definitions.*)', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });

  it('keeps request/response models in data-contracts and imports them in the endpoint file', async () => {
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

    expect(endpoint).toContain('from "../data-contracts"');
    expect(endpoint).toContain('SaveResponseDataType1RequestDC');
    expect(endpoint).toContain('SaveResponseDataType1ResponseDC');
    expect(endpoint).not.toMatch(
      /export interface SaveResponseDataType1ResponseDC\b/,
    );
    expect(dataContracts).toContain(
      'export interface SaveResponseDataType1RequestDC',
    );
    expect(dataContracts).toContain(
      'export interface SaveResponseDataType1ResponseDC',
    );
    expect(endpoint).toMatchSnapshot();
    expect(dataContracts).toMatchSnapshot();
  });
});
