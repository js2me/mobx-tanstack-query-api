import type { AnyObject } from 'yummies/types';

import {
  type EndpointZodContractsResult,
  type OpenAPISchema,
  type OperationWithResponses,
  REF_PREFIX,
  type RequestParam,
} from './types.js';

function parseRef(ref: string): string | null {
  if (typeof ref !== 'string' || !ref.startsWith(REF_PREFIX)) return null;
  return ref.slice(REF_PREFIX.length);
}

/**
 * Extract OpenAPI schema key from response $ref (e.g. from responses['200'].content['application/json'].schema.$ref).
 * Use this for the data contract so we resolve the actual schema (e.g. GoldenApple) instead of the alias type name (GetGoldenAppleDataDC).
 */
export function getResponseSchemaKeyFromOperation(
  rawOperation: OperationWithResponses | Record<string, unknown>,
): string | null {
  const op = rawOperation as OperationWithResponses;
  const responses = op?.responses;
  if (!responses || typeof responses !== 'object') return null;
  const successStatus = Object.keys(responses).find((s) => {
    const code = Number.parseInt(s, 10);
    return code >= 200 && code < 300;
  });
  if (!successStatus) return null;
  const successResponse = responses[successStatus] as
    | {
        content?: Record<string, { schema?: { $ref?: string } }>;
      }
    | undefined;
  const content = successResponse?.content;
  if (!content || typeof content !== 'object') return null;
  const jsonContent = content['application/json'] ?? Object.values(content)[0];
  const ref = jsonContent?.schema?.$ref;
  if (typeof ref !== 'string') return null;
  return parseRef(ref);
}

/**
 * Resolve generated type name to OpenAPI schema key (e.g. RelaySignalPacketDC -> RelaySignalPacket).
 */
export function typeNameToSchemaKey(
  typeName: string,
  typeSuffix = 'DC',
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
    if (key && key in schemas)
      return `z.lazy(() => ${schemaKeyToVarName(key)})`;
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

/**
 * Collect all schema keys referenced from this schema (transitively).
 */
function collectRefs(
  schema: OpenAPISchema | undefined,
  schemas: Record<string, OpenAPISchema>,
  out: Set<string>,
): void {
  if (!schema) return;
  if (schema.$ref) {
    const key = parseRef(schema.$ref);
    if (key && key in schemas && !out.has(key)) {
      out.add(key);
      collectRefs(schemas[key], schemas, out);
    }
    return;
  }
  if (schema.allOf) {
    for (const part of schema.allOf) collectRefs(part, schemas, out);
  }
  if (schema.properties) {
    for (const v of Object.values(schema.properties)) {
      collectRefs(v, schemas, out);
    }
  }
  if (schema.items) collectRefs(schema.items, schemas, out);
  if (typeof schema.additionalProperties === 'object') {
    collectRefs(schema.additionalProperties, schemas, out);
  }
}

/**
 * Generate Zod variable name for a schema key (e.g. RelaySignalPacket -> relaySignalPacketSchema).
 */
export function schemaKeyToVarName(
  key: string,
  utils: { _: AnyObject },
): string {
  const _ = utils._ as typeof import('lodash-es');
  return `${_.camelCase(key)}Schema`;
}

/**
 * Generate auxiliary Zod schema definitions for referenced schemas (so that z.lazy can reference them).
 */
function generateAuxiliarySchemas(
  schemaKeys: string[],
  schemas: Record<string, OpenAPISchema>,
  schemaKeyToVarNameFn: (key: string) => string,
  visited: Set<string>,
): string[] {
  const lines: string[] = [];
  for (const key of schemaKeys) {
    if (visited.has(key)) continue;
    visited.add(key);
    const schema = schemas[key];
    if (!schema) continue;
    const varName = schemaKeyToVarNameFn(key);
    const expr = schemaToZodExpr(
      schema,
      schemas,
      schemaKeyToVarNameFn,
      visited,
    );
    lines.push(`export const ${varName} = ${expr};`);
  }
  return lines;
}

/**
 * Build the content of a central schemas.ts file with all Zod schemas from OpenAPI components.schemas.
 * Endpoints can import these and reference them in their params/data contracts.
 */
export function buildCentralZodSchemasFile(params: {
  componentsSchemas: Record<string, OpenAPISchema>;
  utils: { _: AnyObject };
}): string {
  const { componentsSchemas, utils } = params;
  const schemaKeyToVarNameFn = (key: string) => schemaKeyToVarName(key, utils);
  const lines = generateAuxiliarySchemas(
    Object.keys(componentsSchemas),
    componentsSchemas,
    schemaKeyToVarNameFn,
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
  utils: { _: AnyObject },
  typeSuffix?: string,
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
  const schemaKeyToVarNameFn = (key: string) => schemaKeyToVarName(key, utils);
  const expr = schemaToZodExpr(
    schema,
    schemas,
    schemaKeyToVarNameFn,
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
  utils: { _: AnyObject },
): { expr: string; refs: string[] } {
  const schema = schemas[schemaKey];
  if (!schema) return { expr: 'z.any()', refs: [] };
  const refs = new Set<string>();
  collectRefs(schema, schemas, refs);
  const schemaKeyToVarNameFn = (key: string) => schemaKeyToVarName(key, utils);
  const expr = schemaToZodExpr(
    schema,
    schemas,
    schemaKeyToVarNameFn,
    new Set<string>(),
  );
  return { expr, refs: [...refs] };
}

/**
 * Builds the source code for endpoint Zod contracts: params schema, data schema, and the contracts object.
 * When components.schemas are provided, generates detailed Zod from OpenAPI schemas.
 */
export function buildEndpointZodContractsCode(params: {
  routeNameUsage: string;
  inputParams: RequestParam[];
  responseDataTypeName: string;
  contractsVarName: string;
  utils: { _: AnyObject };
  /** OpenAPI components.schemas for detailed Zod generation */
  componentsSchemas?: Record<string, OpenAPISchema> | null;
  typeSuffix?: string;
  /** When set, use this schema key for data contract instead of resolving from responseDataTypeName (fixes alias types like GetGoldenAppleDataDC -> GoldenApple) */
  responseSchemaKey?: string | null;
  /** When true, do not emit auxiliary schemas inline; they are expected from a central schemas.ts (zodSchemaImportNames will be non-empty) */
  useExternalZodSchemas?: boolean;
}): EndpointZodContractsResult {
  const {
    routeNameUsage,
    inputParams,
    responseDataTypeName,
    contractsVarName,
    utils,
    componentsSchemas = null,
    typeSuffix = 'DC',
    responseSchemaKey,
    useExternalZodSchemas = false,
  } = params;
  const _ = utils._ as typeof import('lodash-es');

  const paramsSchemaName = `${_.camelCase(routeNameUsage)}ParamsSchema`;
  const dataSchemaName = `${_.camelCase(routeNameUsage)}DataSchema`;

  const allAuxiliaryKeys = new Set<string>();
  const paramParts: string[] = [];

  for (const p of inputParams) {
    const { expr, refs: refKeys } = typeToZodSchemaWithSchema(
      p.type,
      componentsSchemas,
      utils,
      typeSuffix,
    );
    for (const k of refKeys) allAuxiliaryKeys.add(k);
    const schemaWithOptional = p.optional ? `${expr}.optional()` : expr;
    paramParts.push(`${p.name}: ${schemaWithOptional}`);
  }

  const responseResult =
    responseSchemaKey &&
    componentsSchemas &&
    responseSchemaKey in componentsSchemas
      ? schemaKeyToZod(responseSchemaKey, componentsSchemas, utils)
      : typeToZodSchemaWithSchema(
          responseDataTypeName,
          componentsSchemas,
          utils,
          typeSuffix,
        );
  const schemaKeyToVarNameFn = (key: string) => schemaKeyToVarName(key, utils);
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
  const zodSchemaImportNames =
    useExternalZodSchemas && allAuxiliaryKeys.size > 0
      ? [...allAuxiliaryKeys].map(schemaKeyToVarNameFn)
      : [];

  const allAuxiliary = useExternalZodSchemas
    ? []
    : generateAuxiliarySchemas(
        [...allAuxiliaryKeys],
        componentsSchemas ?? {},
        schemaKeyToVarNameFn,
        new Set<string>(),
      );

  const paramsFields = paramParts.join(',\n  ');
  const paramsSchemaCode = `export const ${paramsSchemaName} = z.object({
  ${paramsFields},
});`;

  const dataSchemaCode = useDataSchemaFromCentral
    ? `export const ${dataSchemaName} = ${schemaKeyToVarNameFn(responseSchemaKey!)};`
    : `export const ${dataSchemaName} = ${responseResult.expr};`;

  const contractsCode = `export const ${contractsVarName} = {
  params: ${paramsSchemaName},
  data: ${dataSchemaName},
};`;

  const auxiliaryBlock =
    allAuxiliary.length > 0 ? `${allAuxiliary.join('\n\n')}\n\n` : '';
  const content = `${auxiliaryBlock}${paramsSchemaCode}

${dataSchemaCode}

${contractsCode}`;

  return { content, zodSchemaImportNames };
}

export type { EndpointZodContractsResult };
