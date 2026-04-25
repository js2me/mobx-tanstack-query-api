import { camelCase } from 'es-toolkit';
import type { ParsedRoute } from 'swagger-typescript-api';
import { DEFAULT_DATA_CONTRACT_TYPE_SUFFIX } from '../data-contract-type-suffix.js';
import { collectRefs } from '../swagger/collect-refs.js';
import { parseRef } from '../swagger/parse-ref.js';
import { resolveQueryParameters } from '../swagger/resolve-query-parameters.js';
import type { OpenAPIParameter, OpenAPISchema } from '../swagger/types.js';
import { DEFAULT_ZOD_CONTRACT_SUFFIX } from './contract-suffix.js';
import type { EndpointZodContractsResult, RequestParam } from './types.js';

/**
 * Resolve generated type name to OpenAPI schema key (e.g. RelaySignalPacketDC -> RelaySignalPacket).
 */
export function typeNameToSchemaKey(
  typeName: string,
  typeSuffix = DEFAULT_DATA_CONTRACT_TYPE_SUFFIX,
): string {
  const t = typeName.trim();
  if (typeSuffix && t.endsWith(typeSuffix))
    return t.slice(0, -typeSuffix.length);
  return t;
}

function schemaToString(schema: OpenAPISchema): string {
  let s = 'z.string()';
  if (schema.minLength != null) s += `.min(${schema.minLength})`;
  if (schema.maxLength != null) s += `.max(${schema.maxLength})`;
  if (schema.pattern != null)
    s += `.regex(new RegExp(${JSON.stringify(schema.pattern)}))`;
  if (schema.enum != null)
    s = `z.enum([${schema.enum.map((e) => JSON.stringify(e)).join(', ')}])`;
  return s;
}

function schemaToNumber(schema: OpenAPISchema): string {
  let n = 'z.number()';
  if (schema.type === 'integer') n += '.int()';
  if (schema.minimum != null) n += `.min(${schema.minimum})`;
  if (schema.maximum != null) n += `.max(${schema.maximum})`;
  return n;
}

function schemaToArray(
  schema: OpenAPISchema,
  schemas: Record<string, OpenAPISchema>,
  schemaKeyToVarName: (key: string) => string,
  visited: Set<string>,
): string {
  const items = schema.items
    ? schemaToZodExpr(schema.items, schemas, schemaKeyToVarName, visited)
    : 'z.any()';
  let a = `z.array(${items})`;
  if (schema.minItems != null) a += `.min(${schema.minItems})`;
  if (schema.maxItems != null) a += `.max(${schema.maxItems})`;
  return a;
}

function schemaToObject(
  schema: OpenAPISchema,
  schemas: Record<string, OpenAPISchema>,
  schemaKeyToVarName: (key: string) => string,
  visited: Set<string>,
): string {
  if (schema.properties && Object.keys(schema.properties).length > 0) {
    const required = new Set(schema.required ?? []);
    const entries = Object.entries(schema.properties).map(
      ([propName, propSchema]) => {
        const expr = schemaToZodExpr(
          propSchema,
          schemas,
          schemaKeyToVarName,
          visited,
        );
        const optional = !required.has(propName);
        const field = optional ? `${expr}.optional()` : expr;
        return `  ${JSON.stringify(propName)}: ${field}`;
      },
    );
    return `z.object({\n${entries.join(',\n')}\n})`;
  }
  if (schema.additionalProperties === true)
    return 'z.record(z.string(), z.any())';
  if (typeof schema.additionalProperties === 'object') {
    const value = schemaToZodExpr(
      schema.additionalProperties,
      schemas,
      schemaKeyToVarName,
      visited,
    );
    return `z.record(z.string(), ${value})`;
  }
  return 'z.record(z.string(), z.any())';
}

/**
 * Convert a single OpenAPI/JSON Schema to Zod expression string.
 * Uses z.lazy for $ref to support circular refs and correct order.
 */
function schemaToZodExpr(
  schema: OpenAPISchema | undefined,
  schemas: Record<string, OpenAPISchema>,
  schemaKeyToVarName: (key: string) => string,
  visited: Set<string>,
): string {
  if (!schema) return 'z.any()';
  if (schema.$ref) {
    const key = parseRef(schema.$ref);
    if (key && key in schemas) {
      // Явный return type только при цикле (рекурсия), иначе TS сужает тип до any
      const isCycle = visited.has(key);
      return isCycle
        ? `z.lazy((): z.ZodTypeAny => ${schemaKeyToVarName(key)})`
        : `z.lazy(() => ${schemaKeyToVarName(key)})`;
    }
    return 'z.any()';
  }
  if (schema.allOf && schema.allOf.length > 0) {
    const parts = schema.allOf.map((part) =>
      schemaToZodExpr(part, schemas, schemaKeyToVarName, visited),
    );
    const base =
      parts.length === 1
        ? parts[0]
        : parts.reduce((acc, p) => `z.intersection(${acc}, ${p})`);
    return schema.nullable === true ? `${base}.nullable()` : base;
  }

  const nullable = schema.nullable === true;
  let base: string;
  switch (schema.type) {
    case 'string':
      base = schemaToString(schema);
      break;
    case 'integer':
    case 'number':
      base = schemaToNumber(schema);
      break;
    case 'boolean':
      base = 'z.boolean()';
      break;
    case 'array':
      base = schemaToArray(schema, schemas, schemaKeyToVarName, visited);
      break;
    case 'object':
      base = schemaToObject(schema, schemas, schemaKeyToVarName, visited);
      break;
    default:
      base = 'z.any()';
  }
  return nullable ? `${base}.nullable()` : base;
}

export function dataContractTypeNameToZodVarName(
  typeName: string,
  contractSuffix = DEFAULT_ZOD_CONTRACT_SUFFIX,
): string {
  return `${camelCase(typeName)}${contractSuffix}`;
}

/**
 * Generate shared Zod schema variable name for a schema key using the data contract type naming
 * (e.g. RelaySignalPacket + DC -> relaySignalPacketDc).
 */
export function schemaKeyToContractVarName(
  key: string,
  contractSuffix = DEFAULT_ZOD_CONTRACT_SUFFIX,
  typeSuffix = DEFAULT_DATA_CONTRACT_TYPE_SUFFIX,
): string {
  return dataContractTypeNameToZodVarName(
    `${key}${typeSuffix}`,
    contractSuffix,
  );
}

/**
 * Build zod object expression string from resolved query parameters.
 */
function queryParamsToZodObject(
  queryParams: Array<{
    name: string;
    required: boolean;
    schema: OpenAPISchema;
  }>,
  schemas: Record<string, OpenAPISchema>,
  schemaKeyToContractVarName: (key: string) => string,
): string {
  if (queryParams.length === 0) return 'z.object({})';
  const entries = queryParams.map(({ name, required, schema }) => {
    const expr = schemaToZodExpr(
      schema,
      schemas,
      schemaKeyToContractVarName,
      new Set<string>(),
    );
    const field = required ? expr : `${expr}.optional()`;
    return `  ${JSON.stringify(name)}: ${field}`;
  });
  return `z.object({\n${entries.join(',\n')}\n})`;
}

/**
 * Generate auxiliary Zod schema definitions for referenced schemas (so that z.lazy can reference them).
 * Для детекции цикла передаём только текущий ключ (cyclePath), а не все уже обработанные —
 * иначе любой ref на ранее сгенерированную схему ошибочно считался бы циклом и получал ZodTypeAny.
 */
function generateAuxiliarySchemas(
  schemaKeys: string[],
  schemas: Record<string, OpenAPISchema>,
  schemaKeyToContractVarNameFn: (key: string) => string,
  visited: Set<string>,
): string[] {
  const lines: string[] = [];
  for (const key of schemaKeys) {
    if (visited.has(key)) continue;
    visited.add(key);
    const schema = schemas[key];
    if (!schema) continue;
    const varName = schemaKeyToContractVarNameFn(key);
    const cyclePath = new Set<string>([key]);
    const expr = schemaToZodExpr(
      schema,
      schemas,
      schemaKeyToContractVarNameFn,
      cyclePath,
    );
    lines.push(`export const ${varName} = ${expr};`);
  }
  return lines;
}

/**
 * Build the content of a central contracts.ts file with all shared Zod contracts from OpenAPI components.schemas.
 * Endpoints can import these and reference them in their params/data contracts.
 */
export function buildCentralZodContractsFile(params: {
  componentsSchemas: Record<string, OpenAPISchema>;
  contractSuffix?: string;
  typeSuffix?: string;
}): string {
  const {
    componentsSchemas,
    contractSuffix = DEFAULT_ZOD_CONTRACT_SUFFIX,
    typeSuffix = DEFAULT_DATA_CONTRACT_TYPE_SUFFIX,
  } = params;
  const schemaKeyToContractVarNameFn = (key: string) =>
    schemaKeyToContractVarName(key, contractSuffix, typeSuffix);
  const lines = generateAuxiliarySchemas(
    Object.keys(componentsSchemas),
    componentsSchemas,
    schemaKeyToContractVarNameFn,
    new Set<string>(),
  );
  return `import * as z from "zod";

${lines.join('\n\n')}
`;
}

/**
 * Fallback when no OpenAPI schema is available: map type name/string to simple Zod.
 */
function typeToZodSchemaFallback(typeStr: string): string {
  const t = typeStr.trim();
  if (t === 'RequestParams') return 'z.any()';
  if (t === 'Record<string, any>' || t === 'Record<string, unknown>')
    return 'z.record(z.string(), z.any())';
  if (/^Record\s*<\s*string\s*,/i.test(t))
    return 'z.record(z.string(), z.any())';
  if (t === 'string') return 'z.string()';
  if (t === 'number') return 'z.number()';
  if (t === 'boolean') return 'z.boolean()';
  if (t === 'any') return 'z.any()';
  if (t === 'unknown') return 'z.unknown()';
  return 'z.any()';
}

/**
 * Resolve type name to OpenAPI schema and return Zod expr plus refs needed for z.lazy.
 */
export function typeToZodSchemaWithSchema(
  typeStr: string,
  schemas: Record<string, OpenAPISchema> | null,
  typeSuffix: string = DEFAULT_DATA_CONTRACT_TYPE_SUFFIX,
  contractSuffix = DEFAULT_ZOD_CONTRACT_SUFFIX,
): { expr: string; refs: string[] } {
  const t = typeStr.trim();

  if (!schemas || Object.keys(schemas).length === 0) {
    return { expr: typeToZodSchemaFallback(t), refs: [] };
  }

  if (t === 'RequestParams') return { expr: 'z.any()', refs: [] };

  const schemaKey = typeNameToSchemaKey(t, typeSuffix);
  const schema = schemas[schemaKey];
  if (!schema) {
    return { expr: typeToZodSchemaFallback(t), refs: [] };
  }

  const refs = new Set<string>();
  collectRefs(schema, schemas, refs);
  const schemaKeyToContractVarNameFn = (key: string) =>
    schemaKeyToContractVarName(key, contractSuffix, typeSuffix);
  const expr = schemaToZodExpr(
    schema,
    schemas,
    schemaKeyToContractVarNameFn,
    new Set<string>(),
  );
  return { expr, refs: [...refs] };
}

/**
 * Maps a TypeScript type name or expression to a Zod schema code string (fallback only).
 */
export function typeToZodSchema(typeStr: string): string {
  return typeToZodSchemaFallback(typeStr);
}

/**
 * Build Zod expr + refs from a known OpenAPI schema key (for response data when we have $ref from the operation).
 */
function schemaKeyToZod(
  schemaKey: string,
  schemas: Record<string, OpenAPISchema>,
  typeSuffix = DEFAULT_DATA_CONTRACT_TYPE_SUFFIX,
  contractSuffix = DEFAULT_ZOD_CONTRACT_SUFFIX,
): { expr: string; refs: string[] } {
  const schema = schemas[schemaKey];
  if (!schema) return { expr: 'z.any()', refs: [] };
  const refs = new Set<string>();
  collectRefs(schema, schemas, refs);
  const schemaKeyToContractVarNameFn = (key: string) =>
    schemaKeyToContractVarName(key, contractSuffix, typeSuffix);
  const expr = schemaToZodExpr(
    schema,
    schemas,
    schemaKeyToContractVarNameFn,
    new Set<string>(),
  );
  return { expr, refs: [...refs] };
}

/**
 * Builds the source code for endpoint Zod contracts: params schema, data schema, and the contract object.
 * When components.schemas are provided, generates detailed Zod from OpenAPI schemas.
 */
/** Minimal operation shape for resolving query parameters */
export type OpenAPIOperationForZod = {
  parameters?: Array<{
    $ref?: string;
    in?: string;
    name?: string;
    required?: boolean;
    schema?: OpenAPISchema;
    type?: string;
    format?: string;
    items?: OpenAPISchema;
  }>;
};

export function buildEndpointZodContractsCode(params: {
  routeNameUsage: string;
  inputParams: RequestParam[];
  responseDataTypeName: string;
  contractVarName: string;
  contractSuffix?: string;
  /** OpenAPI components.schemas for detailed Zod generation */
  componentsSchemas?: Record<string, OpenAPISchema> | null;
  typeSuffix?: string;
  /** When set, use this schema key for data contract instead of resolving from responseDataTypeName (fixes alias types like GetGoldenAppleDataDC -> GoldenApple) */
  responseSchemaKey?: string | null;
  /** When true, do not emit auxiliary contracts inline; they are expected from a central contracts.ts file (zodContractImportNames will be non-empty) */
  useExternalZodSchemas?: boolean;
  /** OpenAPI operation (path + method) to build query object schema from parameters with in: 'query' */
  openApiOperation?: ParsedRoute['raw'] | null;
  /** OpenAPI components.parameters to resolve $ref in operation.parameters */
  openApiComponentsParameters?: Record<string, OpenAPIParameter> | null;
  /** Name of the input param that holds query (default 'query') */
  queryParamName?: string;
}): EndpointZodContractsResult {
  const {
    inputParams,
    responseDataTypeName,
    contractVarName,
    contractSuffix = DEFAULT_ZOD_CONTRACT_SUFFIX,
    componentsSchemas = null,
    typeSuffix = DEFAULT_DATA_CONTRACT_TYPE_SUFFIX,
    responseSchemaKey,
    useExternalZodSchemas = false,
    openApiOperation = null,
    openApiComponentsParameters = null,
    queryParamName = 'query',
  } = params;
  const allAuxiliaryKeys = new Set<string>();
  const paramParts: string[] = [];

  const resolvedQueryParams =
    openApiOperation &&
    (openApiComponentsParameters || openApiOperation.parameters?.length)
      ? resolveQueryParameters(openApiOperation, openApiComponentsParameters)
      : [];

  const schemaKeyToContractVarNameFn = (key: string) =>
    schemaKeyToContractVarName(key, contractSuffix, typeSuffix);

  for (const p of inputParams) {
    let expr: string;
    let refKeys: string[] = [];

    if (
      p.name === queryParamName &&
      resolvedQueryParams.length > 0 &&
      componentsSchemas
    ) {
      expr = queryParamsToZodObject(
        resolvedQueryParams,
        componentsSchemas,
        schemaKeyToContractVarNameFn,
      );
    } else {
      const result = typeToZodSchemaWithSchema(
        p.type,
        componentsSchemas,
        typeSuffix,
        contractSuffix,
      );
      expr = result.expr;
      refKeys = result.refs;
    }

    for (const k of refKeys) allAuxiliaryKeys.add(k);
    const schemaWithOptional = p.optional ? `${expr}.optional()` : expr;
    paramParts.push(`${p.name}: ${schemaWithOptional}`);
  }

  const responseResult =
    responseSchemaKey &&
    componentsSchemas &&
    responseSchemaKey in componentsSchemas
      ? schemaKeyToZod(
          responseSchemaKey,
          componentsSchemas,
          typeSuffix,
          contractSuffix,
        )
      : typeToZodSchemaWithSchema(
          responseDataTypeName,
          componentsSchemas,
          typeSuffix,
          contractSuffix,
        );
  const useDataSchemaFromCentral =
    useExternalZodSchemas &&
    responseSchemaKey &&
    componentsSchemas &&
    responseSchemaKey in componentsSchemas;
  if (useDataSchemaFromCentral) {
    allAuxiliaryKeys.add(responseSchemaKey);
  } else {
    for (const k of responseResult.refs) allAuxiliaryKeys.add(k);
  }
  const zodContractImportNames =
    useExternalZodSchemas && allAuxiliaryKeys.size > 0
      ? [...allAuxiliaryKeys].map(schemaKeyToContractVarNameFn)
      : [];

  const allAuxiliary = useExternalZodSchemas
    ? []
    : generateAuxiliarySchemas(
        [...allAuxiliaryKeys],
        componentsSchemas ?? {},
        schemaKeyToContractVarNameFn,
        new Set<string>(),
      );

  const paramsFields = paramParts.join(',\n    ');
  const paramsSchemaExpr = `z.object({
    ${paramsFields},
  })`;
  const dataSchemaExpr = useDataSchemaFromCentral
    ? schemaKeyToContractVarNameFn(responseSchemaKey!)
    : responseResult.expr;

  const contractsCode = `export const ${contractVarName} = {
  params: ${paramsSchemaExpr},
  data: ${dataSchemaExpr},
};`;

  const auxiliaryBlock =
    allAuxiliary.length > 0 ? `${allAuxiliary.join('\n\n')}\n\n` : '';
  const content = `${auxiliaryBlock}${contractsCode}`;

  return { content, zodContractImportNames };
}

export type { EndpointZodContractsResult };
