import { describe, expect, it } from 'vitest';
import {
  buildCentralZodContractsFile,
  buildEndpointZodContractsCode,
} from '../../src/codegen/utils/zod/build-endpoint-zod-contracts-code.js';
import * as _ from 'lodash-es';
import type { OpenAPIParameter, OpenAPISchema } from '../../src/codegen/utils/zod/types.js';

const utils = { _ };

/**
 * Репродукция TS(7024): рекурсивная схема без явного return type в z.lazy
 * приводит к "Function implicitly has return type 'any' because it does not have
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
      utils,
    });

    // Без явного типа (): z.ZodTypeAny => TS выдаёт 7024 при рекурсии
    expect(content).toContain('z.lazy((): z.ZodTypeAny =>');
    expect(content).toContain('recursiveNodeContract');
    expect(content).toContain('itemKindContract');
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
      utils,
      componentsSchemas: recursiveSchema,
    });

    expect(content).toContain('z.lazy((): z.ZodTypeAny =>');
    expect(content).toContain('treeNodeContract');
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
      routeNameUsage: 'getItems',
      inputParams,
      responseDataTypeName: 'unknown',
      contractVarName: 'getItemsContract',
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
      contractVarName: 'getItemContract',
      utils,
      componentsSchemas: {},
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
      utils,
      componentsSchemas: recursiveSchema,
      useExternalZodSchemas: true,
    });

    expect(result.zodContractImportNames).toContain('treeNodeValidator');
    expect(result.content).toContain('data: treeNodeValidator');
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
      utils,
    });

    expect(content).toContain('containerSchemaContract');
    expect(content).toContain('nodeWithChildrenContract');

    // Ref'ы на другие схемы — без явного return type (тип выводится)
    expect(content).toContain('z.lazy(() => metaInfoContract)');
    expect(content).toContain('z.lazy(() => linkRefContract)');
    expect(content).toContain('z.lazy(() => itemInfoContract)');
    expect(content).toContain('z.lazy(() => statusKindContract)');
    expect(content).toContain('z.lazy(() => itemSchemaContract)');
    expect(content).toContain('z.lazy(() => childSchemaContract)');
    expect(content).toContain('z.lazy(() => metaSchemaContract)');

    // В этом наборе нет самореференсов — ZodTypeAny не должен встречаться
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
      utils,
    });

    // Только рекурсивная схема использует ZodTypeAny
    const lazyAnyCount = (content.match(/z\.lazy\(\(\):\s*z\.ZodTypeAny\s*=>/g) ?? []).length;
    expect(lazyAnyCount).toBe(1);
    expect(content).toContain('z.lazy((): z.ZodTypeAny => recursiveBoxContract)');

    // Остальные ref'ы по-прежнему без ZodTypeAny
    expect(content).toContain('z.lazy(() => metaInfoContract)');
    expect(content).toContain('z.lazy(() => itemSchemaContract)');
  });
});
