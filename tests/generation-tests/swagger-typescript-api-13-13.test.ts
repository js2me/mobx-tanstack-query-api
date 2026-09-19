import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const OUTPUT_DIR = path.resolve(
  __dirname,
  './__generated__/swagger-typescript-api-13-13',
);

const openApiSchema = {
  openapi: '3.0.0',
  info: { title: 'swagger-typescript-api 13.13 regressions', version: '1.0.0' },
  paths: {
    '/orders/{orderId}': {
      post: {
        operationId: 'getOrder',
        parameters: [
          {
            in: 'path',
            name: 'orderId',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GetOrderParams' },
            },
          },
        },
        responses: { '204': { description: 'Updated' } },
      },
    },
  },
  components: {
    schemas: {
      GetOrderParams: {
        type: 'object',
        required: ['bodyMarker'],
        properties: { bodyMarker: { type: 'string' } },
      },
      Status: { type: 'string', enum: ['ACTIVE', 'DISABLED'] },
      ConstrainedStatus: {
        type: 'object',
        properties: {
          status: {
            $ref: '#/components/schemas/Status',
            not: { enum: ['DISABLED'] },
          },
        },
      },
      StringMap: { additionalProperties: { type: 'string' } },
    },
  },
} as const;

describe('swagger-typescript-api 13.13 regressions', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  });

  it('preserves component refs while resolving extracted parameter-name collisions', async () => {
    await generateApi(
      defineConfig({
        input: openApiSchema,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        noMetaInfo: true,
        outputType: 'one-endpoint-per-file',
        otherCodegenParams: {
          extractRequestParams: true,
          silent: true,
        },
      }),
    );

    const [dataContracts, endpoint] = await Promise.all([
      fs.readFile(path.resolve(OUTPUT_DIR, 'data-contracts.ts'), 'utf-8'),
      fs.readFile(
        path.resolve(OUTPUT_DIR, 'endpoints/get-order.ts'),
        'utf-8',
      ),
    ]);

    expect(dataContracts).toContain('export interface GetOrderParamsDC');
    expect(dataContracts).toContain('bodyMarker: string;');
    expect(endpoint).toContain('data: GetOrderParamsDC');

    expect(dataContracts).toContain('status?: StatusDC;');
    expect(dataContracts).toContain('export type StringMapDC = Record<string, string>;');
  });
});
