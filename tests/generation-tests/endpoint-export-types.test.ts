import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const MEMORY_LEAK_INPUT = path.resolve(__dirname, './get-memory-leak.swagger2.json');
const MEMORY_LEAK_OUTPUT = path.resolve(
  __dirname,
  './__generated__/endpoint-export-types-memory-leak',
);
const MEMORY_LEAK_ENDPOINT = path.resolve(
  MEMORY_LEAK_OUTPUT,
  'endpoints',
  'get-memory-leak.ts',
);

const FOO_BAR_INPUT = path.resolve(
  __dirname,
  './foo-bar-duplicate-data-types.openapi3.json',
);
const FOO_BAR_OUTPUT = path.resolve(
  __dirname,
  './__generated__/endpoint-export-types-foo-bar',
);
const FOO_BAR_ENDPOINT = path.resolve(
  FOO_BAR_OUTPUT,
  'endpoints',
  'get-foo-bar.ts',
);

const normalize = (content: string): string => content.replaceAll('\r\n', '\n');

describe('endpoint exported Data/Params/Error types', () => {
  beforeEach(async () => {
    await fs.rm(MEMORY_LEAK_OUTPUT, { recursive: true, force: true });
    await fs.rm(FOO_BAR_OUTPUT, { recursive: true, force: true });
    await fs.mkdir(path.dirname(MEMORY_LEAK_OUTPUT), { recursive: true });
    await fs.mkdir(path.dirname(FOO_BAR_OUTPUT), { recursive: true });
  });

  it('exports DataDC, Params and ErrorDC for blob response endpoint', async () => {
    await generateApi(
      defineConfig({
        input: MEMORY_LEAK_INPUT,
        output: MEMORY_LEAK_OUTPUT,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
        filterEndpoints: [/^getMemoryLeak$/i],
      }),
    );

    const endpoint = normalize(await fs.readFile(MEMORY_LEAK_ENDPOINT, 'utf-8'));

    expect(endpoint).toContain('export type GetMemoryLeakDataDC = Blob;');
    expect(endpoint).toContain('export type GetMemoryLeakErrorDC = NeutralStatusDC;');
    expect(endpoint).toContain('export type GetMemoryLeakParams = {');
    expect(endpoint).toContain(
      'HttpResponse<GetMemoryLeakDataDC, GetMemoryLeakErrorDC>',
    );
    expect(endpoint).toContain('@**200** GetMemoryLeakDataDC A successful response.');
  });

  it('exports DataDC, Params and ErrorDC for json response endpoint', async () => {
    await generateApi(
      defineConfig({
        input: FOO_BAR_INPUT,
        output: FOO_BAR_OUTPUT,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
        filterEndpoints: [/^getFooBar$/i],
      }),
    );

    const endpoint = normalize(await fs.readFile(FOO_BAR_ENDPOINT, 'utf-8'));

    expect(endpoint).not.toContain(
      'export type GetFooBarDataDC = GetFooBarResultDC;',
    );
    expect(endpoint).toContain(
      'export type GetFooBarResultDC = GetFooBarDataDC;',
    );
    expect(endpoint).toContain(
      'export type GetFooBarErrorDC = any;',
    );
    expect(endpoint).toContain('export type GetFooBarParams = {');
    expect(endpoint).toContain(
      'HttpResponse<GetFooBarResultDC, GetFooBarErrorDC>',
    );
    expect(endpoint).toContain('@**200** GetFooBarResultDC OK');
  });
});
