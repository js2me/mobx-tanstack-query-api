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

describe('codegen: tmplData string | object → meta in generated endpoint', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });

  it('string tmplData is emitted as-is (fields visible in literal form)', async () => {
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

  it('object tmplData is JSON.stringify’d (hyphen keys stay quoted after formatter)', async () => {
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

  it('requestMeta / endpointMeta as static objects (not functions)', async () => {
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
