import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const INPUT_FILE = path.resolve(
  __dirname,
  './result-priority-with-explicit-data-error.swagger2.json',
);
const OUTPUT_DIR = path.resolve(
  __dirname,
  './__generated__/result-priority-with-explicit-data-error',
);
const ENDPOINT_FILE = path.resolve(OUTPUT_DIR, 'endpoints', 'get-collision.ts');

describe('generateApi result/data/error name collision behavior', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });

  it('uses STA-renamed Output/Fail aliases when Data/Error/Result schemas all exist', async () => {
    await generateApi(
      defineConfig({
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
        filterEndpoints: [/^getCollision$/i],
      }),
    );

    const endpoint = (await fs.readFile(ENDPOINT_FILE, 'utf-8')).replaceAll(
      '\r\n',
      '\n',
    );

    expect(endpoint).toContain(
      'import { GetCollisionDataDC, GetCollisionErrorDC, GetCollisionResultDC } from "../data-contracts";',
    );
    // swagger-typescript-api resolves naming collision as Output/Fail;
    // codegen keeps endpoint-level Data/Error aliases that point to them.
    expect(endpoint).toContain('export type GetCollisionDataDC = GetCollisionOutputDC;');
    expect(endpoint).toContain('export type GetCollisionErrorDC = GetCollisionFailDC;');
    expect(endpoint).toContain('export type GetCollisionOutputDC = GetCollisionResultDC;');
    expect(endpoint).toContain(
      'HttpResponse<GetCollisionDataDC, GetCollisionErrorDC>',
    );
    expect(endpoint).toContain('@**200** GetCollisionDataDC OK');
  });
});
