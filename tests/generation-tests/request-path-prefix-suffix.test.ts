import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';
import type { GenerateQueryApiParams } from '../../src/codegen/types/index.js';

const INPUT_FILE = path.resolve(
  __dirname,
  './request-path-prefix-suffix.openapi.json',
);
const OUTPUT_DIR = path.resolve(
  __dirname,
  './__generated__/request-path-prefix-suffix',
);

const baseConfig = {
  input: INPUT_FILE,
  output: OUTPUT_DIR,
  noBarrelFiles: true,
  removeUnusedTypes: true,
  outputType: 'one-endpoint-per-file' as const,
  zodContracts: false,
} satisfies Pick<
  GenerateQueryApiParams,
  | 'input'
  | 'output'
  | 'noBarrelFiles'
  | 'removeUnusedTypes'
  | 'outputType'
  | 'zodContracts'
>;

describe('requestPathPrefix and requestPathSuffix', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });

  it('requestPathPrefix: string is inlined into path as a literal', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        requestPathPrefix: '/__STATIC_PREFIX__',
        filterEndpoints: (ep) => ep.raw.operationId === 'listWidgets',
      }),
    );

    const content = await fs.readFile(
      path.resolve(OUTPUT_DIR, 'endpoints', 'list-widgets.ts'),
      'utf-8',
    );

    expect(content).toContain('path: `/__STATIC_PREFIX__/widgets`');
  });

  it('requestPathPrefix: function runs at codegen and result is emitted in path', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        requestPathPrefix: (ep): string =>
          ep.operationId === 'createGadget'
            ? '/gadget-service'
            : '/default-service',
        filterEndpoints: (ep) => ep.raw.operationId === 'createGadget',
      }),
    );

    const content = await fs.readFile(
      path.resolve(OUTPUT_DIR, 'endpoints', 'create-gadget.ts'),
      'utf-8',
    );

    expect(content).toContain('path: `/gadget-service/gadgets`');
    expect(content).not.toContain('/default-service');
  });

  it('requestPathSuffix: string is inlined into path as a literal', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        requestPathSuffix: '/__STATIC_SUFFIX__',
        filterEndpoints: (ep) => ep.raw.operationId === 'listWidgets',
      }),
    );

    const content = await fs.readFile(
      path.resolve(OUTPUT_DIR, 'endpoints', 'list-widgets.ts'),
      'utf-8',
    );

    expect(content).toContain('path: `/widgets/__STATIC_SUFFIX__`');
  });

  it('requestPathSuffix: function runs at codegen and result is emitted in path', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        requestPathSuffix: (ep): string =>
          ep.method.toLowerCase() === 'post' ? '/after-post' : '/after-get',
        filterEndpoints: (ep) => ep.raw.operationId === 'createGadget',
      }),
    );

    const content = await fs.readFile(
      path.resolve(OUTPUT_DIR, 'endpoints', 'create-gadget.ts'),
      'utf-8',
    );

    expect(content).toContain('path: `/gadgets/after-post`');
    expect(content).not.toContain('after-get');
  });
});
