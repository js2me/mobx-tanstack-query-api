import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const MEMORY_LEAK_INPUT = path.resolve(__dirname, './fixtures/get-memory-leak.swagger2.json');
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
  './fixtures/foo-bar-duplicate-data-types.openapi3.json',
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
const FOO_BAR_OUTPUT_SKIP_HTTP = path.resolve(
  __dirname,
  './__generated__/endpoint-export-types-foo-bar-skip-http',
);
const FOO_BAR_ENDPOINT_SKIP_HTTP = path.resolve(
  FOO_BAR_OUTPUT_SKIP_HTTP,
  'endpoints',
  'get-foo-bar.ts',
);
const FOO_BAR_OUTPUT_SKIP_QUERY = path.resolve(
  __dirname,
  './__generated__/endpoint-export-types-foo-bar-skip-query',
);
const FOO_BAR_ENDPOINT_SKIP_QUERY = path.resolve(
  FOO_BAR_OUTPUT_SKIP_QUERY,
  'endpoints',
  'get-foo-bar.ts',
);

const normalize = (content: string): string => content.replaceAll('\r\n', '\n');

describe('endpoint exported Data/Params/Error types', () => {
  beforeEach(async () => {
    await fs.rm(MEMORY_LEAK_OUTPUT, { recursive: true, force: true });
    await fs.rm(FOO_BAR_OUTPUT, { recursive: true, force: true });
    await fs.rm(FOO_BAR_OUTPUT_SKIP_HTTP, { recursive: true, force: true });
    await fs.rm(FOO_BAR_OUTPUT_SKIP_QUERY, { recursive: true, force: true });
    await fs.mkdir(path.dirname(MEMORY_LEAK_OUTPUT), { recursive: true });
    await fs.mkdir(path.dirname(FOO_BAR_OUTPUT), { recursive: true });
    await fs.mkdir(path.dirname(FOO_BAR_OUTPUT_SKIP_HTTP), { recursive: true });
    await fs.mkdir(path.dirname(FOO_BAR_OUTPUT_SKIP_QUERY), { recursive: true });
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

  it('httpClient skip omits http import and passes undefined as any', async () => {
    await generateApi(
      defineConfig({
        input: FOO_BAR_INPUT,
        output: FOO_BAR_OUTPUT_SKIP_HTTP,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
        filterEndpoints: [/^getFooBar$/i],
        httpClient: 'skip',
      }),
    );

    const endpoint = normalize(await fs.readFile(FOO_BAR_ENDPOINT_SKIP_HTTP, 'utf-8'));

    expect(endpoint).toContain('undefined as any');
    expect(endpoint).not.toMatch(/import\s*\{[^}]*\bhttp\b[^}]*\}\s*from/);
    expect(endpoint).toMatch(
      /import\s*\{\s*queryClient\s*\}\s*from\s*["']mobx-tanstack-query-api\/builtin["']/,
    );
  });

  it('queryClient skip omits queryClient import and passes undefined as any', async () => {
    await generateApi(
      defineConfig({
        input: FOO_BAR_INPUT,
        output: FOO_BAR_OUTPUT_SKIP_QUERY,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
        filterEndpoints: [/^getFooBar$/i],
        queryClient: 'skip',
      }),
    );

    const endpoint = normalize(await fs.readFile(FOO_BAR_ENDPOINT_SKIP_QUERY, 'utf-8'));

    expect(endpoint).toContain('undefined as any');
    expect(endpoint).not.toMatch(/import\s*\{[^}]*\bqueryClient\b[^}]*\}\s*from/);
    expect(endpoint).toMatch(
      /import\s*\{\s*http\s*\}\s*from\s*["']mobx-tanstack-query-api\/builtin["']/,
    );
  });
});
