import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const OUTPUT_DIR = path.resolve(
  __dirname,
  './__generated__/header-parameters',
);

const schema = {
  openapi: '3.0.3',
  info: { title: 'Header parameters', version: '1.0.0' },
  paths: {
    '/widgets/{widgetId}': {
      get: {
        operationId: 'getWidget',
        parameters: [
          { name: 'widgetId', in: 'path', required: true, schema: { type: 'string' } },
          { $ref: '#/components/parameters/RequestId' },
          { name: 'X-Optional', in: 'header', required: false, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Widget',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
  },
  components: {
    parameters: {
      RequestId: {
        name: 'X-Request-Id',
        in: 'header',
        required: true,
        schema: { type: 'string', minLength: 1 },
      },
    },
  },
};

describe('header parameters', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  });

  it('generates required and optional OpenAPI headers', async () => {
    await generateApi(
      defineConfig({
        input: schema,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
        zodContracts: true,
      }),
    );

    const content = await fs.readFile(
      path.resolve(OUTPUT_DIR, 'endpoints', 'get-widget.ts'),
      'utf-8',
    );

    expect(content).toContain(
      'headers: { ...headers, ...requestParams?.headers }',
    );
    expect(content).toContain('type IsPartial,');
    expect(content).toContain('} from "mobx-tanstack-query-api";');
    expect(content).toContain('Record<string, any> & GetWidgetHeaders');
    expect(content).toContain('IsPartial<GetWidgetHeaders> extends true');
    expect(content).not.toContain('GetWidgetHeadersParam');
    expect(content).toContain('.passthrough()');
    expect(content).toContain('"headers"');
    expect(content).toContain('"X-Request-Id"');
    expect(content).toContain('"X-Optional"');
    expect(content).toMatch(/requiredParams: \[.*"headers".*\]/s);
    expect(content).toContain('params: z.object({');
  });
});
