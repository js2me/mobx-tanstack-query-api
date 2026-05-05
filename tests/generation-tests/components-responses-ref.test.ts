/** @vitest-environment node */

import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const INPUT_FILE = path.resolve(
  __dirname,
  './fixtures/components-responses.openapi.yaml',
);
const OUTPUT_DIR = path.resolve(__dirname, './__generated__/components-responses');
const ENDPOINT_FILE = path.resolve(OUTPUT_DIR, 'endpoints.ts');
const DATA_CONTRACTS_FILE = path.resolve(OUTPUT_DIR, 'data-contracts.ts');

describe('generateApi non-schema components refs', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });

  it('extracts data contracts from components responses and custom sections', async () => {
    await generateApi(
      defineConfig({
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'endpoints-per-file',
      }),
    );

    const content = (await fs.readFile(ENDPOINT_FILE, 'utf-8')).replaceAll(
      '\r\n',
      '\n',
    );
    const dataContracts = (
      await fs.readFile(DATA_CONTRACTS_FILE, 'utf-8')
    ).replaceAll('\r\n', '\n');

    // настоящие компонент-типы из components.responses / кастомных секций
    // должны лежать в data-contracts.ts и импортироваться в файл эндпоинтов
    expect(dataContracts).toContain('export interface R001DC');
    expect(dataContracts).toContain('export type R002DC = R001DC &');
    expect(content).toContain('from "./data-contracts"');
    expect(content).toMatch(/import\s*\{[^}]*\bR002DC\b[^}]*\}\s*from\s*"\.\/data-contracts"/);

    // Operation-level алиасы должны жить рядом с эндпоинтом, а не в
    // data-contracts.ts (правило: типы, относящиеся ТОЛЬКО к эндпоинту,
    // лежат в файле эндпоинта).
    expect(content).toContain('export type Op001DataDC = R002DC;');
    expect(content).toContain('export type Op002DataDC = R002DC;');
    expect(dataContracts).not.toContain('Op001DataDC');
    expect(dataContracts).not.toContain('Op002DataDC');
  });
});
