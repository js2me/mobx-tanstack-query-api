import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';
import type { GenerateQueryApiParams } from '../../src/codegen/types/index.js';

const INPUT_FILE = path.resolve(
  __dirname,
  './fixtures/big-schema-2.swagger.json',
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
      }),
    );

    const content = await fs.readFile(
      path.resolve(OUTPUT_DIR, 'endpoints', 'op-0001.ts'),
      'utf-8',
    );

    expect(content).toContain('path: `/__STATIC_PREFIX__/r/95/${frugalLegging446}`');
    expect(content).toContain('@request **POST:/__STATIC_PREFIX__/r/95/{frugal_legging_446}**');
  });

  it('requestPathPrefix: function runs at codegen and result is emitted in path', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        requestPathPrefix: (ep): string =>
          ep.operationId === 'op0001'
            ? '/gadget-service'
            : '/default-service',
      }),
    );

    const content = await fs.readFile(
      path.resolve(OUTPUT_DIR, 'endpoints', 'op-0001.ts'),
      'utf-8',
    );

    expect(content).toContain('path: `/gadget-service/r/95/${frugalLegging446}`');
    expect(content).toContain('@request **POST:/gadget-service/r/95/{frugal_legging_446}**');
    expect(content).not.toContain('/default-service');
  });

  it('requestPathSuffix: string is inlined into path as a literal', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        requestPathSuffix: '/__STATIC_SUFFIX__',
      }),
    );

    const content = await fs.readFile(
      path.resolve(OUTPUT_DIR, 'endpoints', 'op-0001.ts'),
      'utf-8',
    );

    expect(content).toContain('path: `/r/95/${frugalLegging446}/__STATIC_SUFFIX__`');
    expect(content).toContain('@request **POST:/r/95/{frugal_legging_446}/__STATIC_SUFFIX__**');
  });

  it('requestPathSuffix: function runs at codegen and result is emitted in path', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        requestPathSuffix: (ep): string =>
          ep.method.toLowerCase() === 'post' ? '/after-post' : '/after-get',
        // filterEndpoints: (ep) => ep.raw.operationId === 'createGadget',
      }),
    );

    const content = await fs.readFile(
      path.resolve(OUTPUT_DIR, 'endpoints', 'op-0001.ts'),
      'utf-8',
    );

    expect(content).toContain('path: `/r/95/${frugalLegging446}/after-post`');
    expect(content).toContain('@request **POST:/r/95/{frugal_legging_446}/after-post**');
    expect(content).not.toContain('after-get');
  });
});
