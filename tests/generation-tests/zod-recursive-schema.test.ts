import { describe, expect, it } from 'vitest';
import {
  buildCentralZodSchemasFile,
  buildEndpointZodContractsCode,
} from '../../src/codegen/utils/zod/build-endpoint-zod-contracts-code.js';
import _ from 'lodash-es';
import type { OpenAPIParameter, OpenAPISchema } from '../../src/codegen/utils/zod/types.js';

const utils = { _ };

/**
 * Репродукция TS(7024): рекурсивная схема без явного return type в z.lazy
 * приводит к "Function implicitly has return type 'any' because it does not have
 * a return type annotation and is referenced directly or indirectly in one of its return expressions."
 */
describe('zod recursive schema — explicit return type for z.lazy (TS 7024)', () => {
  it('buildCentralZodSchemasFile emits z.lazy((): z.ZodTypeAny => ...) for $ref', () => {
    const recursiveSchema: Record<string, OpenAPISchema> = {
      ItemKind: { type: 'string', enum: ['info', 'warning', 'error'] },
      RecursiveNode: {
        type: 'object',
        properties: {
          details: { type: 'string' },
          id: { type: 'integer' },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/RecursiveNode' },
          },
          message: { type: 'string' },
          timestamp: { type: 'string' },
          type: { $ref: '#/components/schemas/ItemKind' },
          userLogin: { type: 'string' },
        },
        required: ['id', 'message', 'timestamp', 'type', 'userLogin'],
      },
    };

    const content = buildCentralZodSchemasFile({
      componentsSchemas: recursiveSchema,
      utils,
    });

    // Без явного типа (): z.ZodTypeAny => TS выдаёт 7024 при рекурсии
    expect(content).toContain('z.lazy((): z.ZodTypeAny =>');
    expect(content).toContain('recursiveNodeSchema');
    expect(content).toContain('itemKindSchema');
  });

  it('buildEndpointZodContractsCode emits z.lazy((): z.ZodTypeAny => ...) in auxiliary schemas', () => {
    const recursiveSchema: Record<string, OpenAPISchema> = {
      TreeNode: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          children: {
            type: 'array',
            items: { $ref: '#/components/schemas/TreeNode' },
          },
        },
        required: ['id'],
      },
    };

    const { content } = buildEndpointZodContractsCode({
      routeNameUsage: 'getTree',
      inputParams: [],
      responseDataTypeName: 'TreeNodeDC',
      contractsVarName: 'getTreeContracts',
      utils,
      componentsSchemas: recursiveSchema,
    });

    expect(content).toContain('z.lazy((): z.ZodTypeAny =>');
    expect(content).toContain('treeNodeSchema');
  });
});

/**
 * Параметр query с вложенным объектом (query?: { filterKey?: string }) должен
 * давать z.object({ filterKey: z.string().optional() }).optional(), а не z.any().optional().
 */
describe('zod params schema — query object from OpenAPI operation parameters', () => {
  it('buildEndpointZodContractsCode emits z.object with query fields when openApiOperation has query params', () => {
    const operation = {
      parameters: [
        { in: 'query' as const, name: 'filterKey', required: false, schema: { type: 'string' } },
      ],
    };
    const inputParams = [
      { name: 'resourceId', optional: false, type: 'number' },
      { name: 'query', optional: true, type: '{ filterKey?: string }' },
      { name: 'requestParams', optional: true, type: 'RequestParams' },
    ];

    const { content } = buildEndpointZodContractsCode({
      routeNameUsage: 'getResourceList',
      inputParams,
      responseDataTypeName: 'unknown',
      contractsVarName: 'getResourceListContracts',
      utils,
      componentsSchemas: {},
      openApiOperation: operation,
      openApiComponentsParameters: null,
      queryParamName: 'query',
    });

    expect(content).toContain('"filterKey": z.string().optional()');
    expect(content).not.toMatch(/query:\s*z\.any\(\)\.optional\(\)/);
    expect(content).toContain('query: z.object({');
  });

  it('buildEndpointZodContractsCode uses components.parameters when operation has $ref', () => {
    const operation = {
      parameters: [{ $ref: '#/components/parameters/FilterKeyParam' }],
    };
    const componentsParameters: Record<string, OpenAPIParameter> = {
      FilterKeyParam: {
        name: 'filterKey',
        in: 'query',
        required: false,
        schema: { type: 'string' },
      },
    };
    const inputParams = [
      { name: 'query', optional: true, type: 'object' },
    ];

    const { content } = buildEndpointZodContractsCode({
      routeNameUsage: 'getItem',
      inputParams,
      responseDataTypeName: 'unknown',
      contractsVarName: 'getItemContracts',
      utils,
      componentsSchemas: {},
      openApiOperation: operation,
      openApiComponentsParameters: componentsParameters,
      queryParamName: 'query',
    });

    expect(content).toContain('"filterKey": z.string().optional()');
  });
});
