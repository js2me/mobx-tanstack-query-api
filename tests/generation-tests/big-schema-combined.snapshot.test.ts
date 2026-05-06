/** @vitest-environment node */

import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const INPUT_FILE = path.resolve(__dirname, './fixtures/big-schema.openapi.yaml');
const OUTPUT_DIR = path.resolve(
  __dirname,
  './__generated__/big-schema-combined-snapshot',
);

const normalizeNewlines = (value: string) => value.replaceAll('\r\n', '\n');

describe('generateApi snapshot big-schema (anonymized fixture)', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });

  it('generates data-contracts and API client in one snapshot bundle', async () => {
    await generateApi(
      defineConfig({
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'endpoints-per-file',
      }),
    );

    const dataContracts = normalizeNewlines(
      await fs.readFile(path.resolve(OUTPUT_DIR, 'data-contracts.ts'), 'utf-8'),
    );
    const endpoints = normalizeNewlines(
      await fs.readFile(path.resolve(OUTPUT_DIR, 'endpoints.ts'), 'utf-8'),
    );

    const combined = [
      '/* --- data-contracts.ts --- */',
      dataContracts,
      '',
      '/* --- endpoints.ts (API client) --- */',
      endpoints,
      '',
    ].join('\n');

    expect(combined).toMatchSnapshot();

    // настоящий schema-тип лежит в data-contracts.ts
    expect(dataContracts).toContain('export interface SchAjarCinema32DC');

    // operation-level алиасы (Op0001DataDC, Op0002DataDC, ...) должны быть
    // объявлены ЛОКАЛЬНО в файле эндпоинтов, а не импортироваться из data-contracts.
    expect(endpoints).toContain('export type Op0001DataDC');
    expect(endpoints).toContain('export type Op0002DataDC');
    expect(dataContracts).not.toContain('Op0001DataDC');
    expect(dataContracts).not.toContain('Op0002DataDC');
  });
});
