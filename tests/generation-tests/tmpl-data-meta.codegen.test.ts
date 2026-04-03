import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const INPUT_FILE = path.resolve(__dirname, './tmpl-data-meta.openapi.json');
const OUTPUT_DIR = path.resolve(__dirname, './__generated__/tmpl-data-meta');
const ENDPOINT_FILE = path.resolve(
  OUTPUT_DIR,
  'endpoints',
  'get-tmpl-data-meta-probe.ts',
);

describe('codegen: tmplData string | object → meta в сгенерированном endpoint', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });

  it('строковый tmplData вставляется в код как есть (поля видны в literal-форме)', async () => {
    await generateApi(
      defineConfig({
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
        filterEndpoints: [/^getTmplDataMetaProbe$/i],
        requestMeta: () => ({
          tmplData: `{ __requestMetaStr: "from-string" }`,
        }),
        endpointMeta: () => ({
          tmplData: `{ __endpointMetaStr: "from-string" }`,
        }),
      }),
    );

    const content = (await fs.readFile(ENDPOINT_FILE, 'utf-8')).replaceAll(
      '\r\n',
      '\n',
    );

    expect(content).toContain('__requestMetaStr: "from-string"');
    expect(content).toContain('__endpointMetaStr: "from-string"');
  });

  it('объектный tmplData проходит JSON.stringify (ключи с дефисом остаются в кавычках после форматтера)', async () => {
    await generateApi(
      defineConfig({
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
        filterEndpoints: [/^getTmplDataMetaProbe$/i],
        requestMeta: () => ({
          tmplData: { 'request-meta-from-object': 'from-object' },
        }),
        endpointMeta: () => ({
          tmplData: { 'endpoint-meta-from-object': 'from-object' },
        }),
      }),
    );

    const content = (await fs.readFile(ENDPOINT_FILE, 'utf-8')).replaceAll(
      '\r\n',
      '\n',
    );

    expect(content).toContain('"request-meta-from-object": "from-object"');
    expect(content).toContain('"endpoint-meta-from-object": "from-object"');
  });

  it('requestMeta / endpointMeta как статические объекты (не функции)', async () => {
    await generateApi(
      defineConfig({
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
        filterEndpoints: [/^getTmplDataMetaProbe$/i],
        requestMeta: {
          tmplData: `{ __requestMetaStatic: true }`,
        },
        endpointMeta: {
          tmplData: `{ __endpointMetaStatic: true }`,
        },
      }),
    );

    const content = (await fs.readFile(ENDPOINT_FILE, 'utf-8')).replaceAll(
      '\r\n',
      '\n',
    );

    expect(content).toContain('__requestMetaStatic: true');
    expect(content).toContain('__endpointMetaStatic: true');
  });

  it('legacy getRequestMeta / getEndpointMeta log a deprecation warning once', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await generateApi(
      defineConfig({
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
        filterEndpoints: [/^getTmplDataMetaProbe$/i],
        getRequestMeta: () => ({ tmplData: '{}' }),
        getEndpointMeta: () => ({ tmplData: '{}' }),
      }),
    );

    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('getEndpointMeta');
    expect(warnSpy.mock.calls[0]?.[0]).toContain('endpointMeta');
    expect(warnSpy.mock.calls[1]?.[0]).toContain('getRequestMeta');
    expect(warnSpy.mock.calls[1]?.[0]).toContain('requestMeta');

    warnSpy.mockRestore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
