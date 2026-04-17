import { describe, expect, it } from 'vitest';
import {
  buildCentralZodContractsFile,
  buildEndpointZodContractsCode,
} from '../../src/codegen/utils/zod/build-endpoint-zod-contracts-code.js';
import * as _ from 'lodash-es';
import { OpenAPIParameter, OpenAPISchema } from '../../src/codegen/utils/swagger/types.js';

const utils = { _ };

/**
 * Repro for TS(7024): a recursive schema without an explicit return type on z.lazy
 * leads to "Function implicitly has return type 'any' because it does not have
 * a return type annotation and is referenced directly or indirectly in one of its return expressions."
 */
describe('zod recursive schema — explicit return type for z.lazy (TS 7024)', () => {
  it('buildCentralZodContractsFile emits z.lazy((): z.ZodTypeAny => ...) for $ref', () => {
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

    const content = buildCentralZodContractsFile({
      componentsSchemas: recursiveSchema,
    });

    // Without explicit (): z.ZodTypeAny => TS reports 7024 for recursion
    expect(content).toContain('z.lazy((): z.ZodTypeAny =>');
    expect(content).toContain('recursiveNodeDc');
    expect(content).toContain('itemKindDc');
  });

  it('buildEndpointZodContractsCode emits z.lazy((): z.ZodTypeAny => ...) in auxiliary contracts', () => {
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
      contractVarName: 'getTreeContract',
      componentsSchemas: recursiveSchema,
    });

    expect(content).toContain('z.lazy((): z.ZodTypeAny =>');
    expect(content).toContain('treeNodeDc');
  });
});

/**
 * A query param with nested object (query?: { filterKey?: string }) should emit
 * z.object({ filterKey: z.string().optional() }).optional(), not z.any().optional().
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
      routeNameUsage: 'getItems',
      inputParams,
      responseDataTypeName: 'unknown',
      contractVarName: 'getItemsContract',
      utils,
      componentsSchemas: {},
      // @ts-expect-error
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
      contractVarName: 'getItemContract',
      utils,
      componentsSchemas: {},
      // @ts-expect-error
      openApiOperation: operation,
      openApiComponentsParameters: componentsParameters,
      queryParamName: 'query',
    });

    expect(content).toContain('"filterKey": z.string().optional()');
  });

  it('buildEndpointZodContractsCode respects custom contractSuffix for shared imports', () => {
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

    const result = buildEndpointZodContractsCode({
      routeNameUsage: 'getTree',
      inputParams: [],
      responseDataTypeName: 'TreeNodeDC',
      responseSchemaKey: 'TreeNode',
      contractVarName: 'getTreeValidator',
      contractSuffix: 'Validator',
      componentsSchemas: recursiveSchema,
      useExternalZodSchemas: true,
    });

    expect(result.zodContractImportNames).toContain('treeNodeDcValidator');
    expect(result.content).toContain('data: treeNodeDcValidator');
  });
});

describe('zod central schemas — no ZodTypeAny for non-cyclic refs', () => {
  const nonCyclicSchemas: Record<string, OpenAPISchema> = {
    StatusKind: { type: 'string', enum: ['STATUS_A', 'STATUS_B'] },
    MetaInfo: {
      type: 'object',
      properties: {
        timestamp: { type: 'string', format: 'date-time' },
        user: { type: 'string' },
      },
      required: ['user', 'timestamp'],
    },
    LinkRef: {
      type: 'object',
      properties: { name: { type: 'string' }, url: { type: 'string' } },
      required: ['name', 'url'],
    },
    ItemInfo: {
      type: 'object',
      properties: { id: { type: 'integer' }, name: { type: 'string' } },
      required: ['id', 'name'],
    },
    ItemSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        size: { type: 'integer' },
      },
      required: ['name'],
    },
    ChildSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
    },
    MetaSchema: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        total: { type: 'number' },
      },
    },
    ContainerSchema: {
      type: 'object',
      properties: {
        canEdit: { type: 'boolean' },
        id: { type: 'integer' },
        lastModified: { $ref: '#/components/schemas/MetaInfo' },
        links: {
          type: 'array',
          items: { $ref: '#/components/schemas/LinkRef' },
        },
        name: { type: 'string' },
        refInfo: { $ref: '#/components/schemas/ItemInfo' },
        status: { $ref: '#/components/schemas/StatusKind' },
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/ItemSchema' },
        },
      },
      required: ['id', 'name'],
    },
    NodeWithChildren: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/ItemSchema' },
        },
        children: {
          type: 'array',
          items: { $ref: '#/components/schemas/ChildSchema' },
        },
        name: { type: 'string' },
        meta: { $ref: '#/components/schemas/MetaSchema' },
      },
      required: ['name'],
    },
  };

  it('buildCentralZodContractsFile does not emit ZodTypeAny for refs to other contracts (only for self-ref)', () => {
    const content = buildCentralZodContractsFile({
      componentsSchemas: nonCyclicSchemas,
    });

    expect(content).toContain('containerSchemaDc');
    expect(content).toContain('nodeWithChildrenDc');

    // Refs to other schemas — no explicit return type (inferred)
    expect(content).toContain('z.lazy(() => metaInfoDc)');
    expect(content).toContain('z.lazy(() => linkRefDc)');
    expect(content).toContain('z.lazy(() => itemInfoDc)');
    expect(content).toContain('z.lazy(() => statusKindDc)');
    expect(content).toContain('z.lazy(() => itemSchemaDc)');
    expect(content).toContain('z.lazy(() => childSchemaDc)');
    expect(content).toContain('z.lazy(() => metaSchemaDc)');

    // No self-references in this set — ZodTypeAny must not appear
    expect(content).not.toContain('z.lazy((): z.ZodTypeAny =>');
  });

  it('buildCentralZodContractsFile emits ZodTypeAny only for self-reference in same schema set', () => {
    const withRecursive: Record<string, OpenAPISchema> = {
      ...nonCyclicSchemas,
      RecursiveBox: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          nested: { $ref: '#/components/schemas/RecursiveBox' },
        },
        required: ['id'],
      },
    };
    const content = buildCentralZodContractsFile({
      componentsSchemas: withRecursive,
    });

    // Only the recursive schema uses ZodTypeAny
    const lazyAnyCount = (content.match(/z\.lazy\(\(\):\s*z\.ZodTypeAny\s*=>/g) ?? []).length;
    expect(lazyAnyCount).toBe(1);
    expect(content).toContain('z.lazy((): z.ZodTypeAny => recursiveBoxDc)');

    // Other refs still omit ZodTypeAny
    expect(content).toContain('z.lazy(() => metaInfoDc)');
    expect(content).toContain('z.lazy(() => itemSchemaDc)');
  });
});
