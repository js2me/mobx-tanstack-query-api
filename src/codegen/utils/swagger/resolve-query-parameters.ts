import type { ParsedRoute } from 'swagger-typescript-api';
import { parseParamRef } from './parse-param-ref.js';
import type { OpenAPIParameter, OpenAPISchema } from './types.js';

/**
 * Resolve operation.parameters to a list of query params { name, required, schema }.
 * Expands $ref from components.parameters. Supports OAS2 (type/items on param) and OAS3 (param.schema).
 */
export function resolveQueryParameters(
  operation: ParsedRoute['raw'] | null,
  componentsParameters: Record<string, OpenAPIParameter> | null,
): Array<{ name: string; required: boolean; schema: OpenAPISchema }> {
  const list: Array<{
    name: string;
    required: boolean;
    schema: OpenAPISchema;
  }> = [];
  const params = operation?.parameters;
  if (!Array.isArray(params) || !params.length) return list;
  for (const p of params) {
    let param: OpenAPIParameter = p as OpenAPIParameter;
    if ('$ref' in p && p.$ref && componentsParameters) {
      const key = parseParamRef(p.$ref);
      if (key && key in componentsParameters)
        param = componentsParameters[key] as OpenAPIParameter;
    }
    if (param.in !== 'query') continue;
    const name = param.name;
    if (!name) continue;
    const schema: OpenAPISchema = param.schema ?? {
      type: param.type ?? 'string',
      format: param.format,
      items: param.items,
    };
    list.push({
      name,
      required: param.required === true,
      schema,
    });
  }
  return list;
}
