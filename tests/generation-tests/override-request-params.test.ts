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
  './__generated__/override-request-params',
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

describe('overrideRequestParams', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });

  it('inlines static partial FullRequestParams before ...requestParams', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        overrideRequestParams: { secure: true, baseUrl: 'https://api.example' },
        filterEndpoints: (ep) => ep.raw.operationId === 'listWidgets',
      }),
    );

    const content = await fs.readFile(
      path.resolve(OUTPUT_DIR, 'endpoints', 'list-widgets.ts'),
      'utf-8',
    );

    expect(content).toContain('secure: true');
    expect(content).toContain('https://api.example');
    const secureIdx = content.indexOf('secure: true');
    const requestParamsIdx = content.indexOf('...requestParams');
    expect(secureIdx).toBeGreaterThan(-1);
    expect(requestParamsIdx).toBeGreaterThan(-1);
    expect(secureIdx).toBeLessThan(requestParamsIdx);
  });

  it('function receives RouteBaseInfo and result is emitted per endpoint', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        overrideRequestParams: (route) =>
          route.operationId === 'createGadget'
            ? { meta: { svc: 'gadget' } }
            : { meta: { svc: 'other' } },
        filterEndpoints: (ep) => ep.raw.operationId === 'createGadget',
      }),
    );

    const content = await fs.readFile(
      path.resolve(OUTPUT_DIR, 'endpoints', 'create-gadget.ts'),
      'utf-8',
    );

    expect(content).toContain('svc: "gadget"');
    expect(content).not.toContain('svc: "other"');
  });

  it('non-empty string is emitted as raw spread expression ...(<expr>),', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        overrideRequestParams: '{ secure: true }',
        filterEndpoints: (ep) => ep.raw.operationId === 'listWidgets',
      }),
    );

    const content = await fs.readFile(
      path.resolve(OUTPUT_DIR, 'endpoints', 'list-widgets.ts'),
      'utf-8',
    );

    expect(content).toMatch(/\.\.\.\s*\{\s*secure:\s*true\s*\}\s*,/);
    const spreadIdx = content.search(/\.\.\.\s*\{\s*secure:\s*true\s*\}\s*,/);
    const requestParamsIdx = content.indexOf('...requestParams');
    expect(spreadIdx).toBeGreaterThan(-1);
    expect(requestParamsIdx).toBeGreaterThan(-1);
    expect(spreadIdx).toBeLessThan(requestParamsIdx);
  });

  it('whitespace-only string emits no override spread', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        overrideRequestParams: '   \n\t  ',
        filterEndpoints: (ep) => ep.raw.operationId === 'listWidgets',
      }),
    );

    const content = await fs.readFile(
      path.resolve(OUTPUT_DIR, 'endpoints', 'list-widgets.ts'),
      'utf-8',
    );

    expect(content).not.toContain('...({ secure:');
  });

  it('falsy resolved value emits no extra spread', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        overrideRequestParams: () => undefined,
        filterEndpoints: (ep) => ep.raw.operationId === 'listWidgets',
      }),
    );

    const content = await fs.readFile(
      path.resolve(OUTPUT_DIR, 'endpoints', 'list-widgets.ts'),
      'utf-8',
    );

    expect(content).not.toMatch(/\.\.\.\(\{/);
  });
});
