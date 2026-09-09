import type { ParsedRoute } from 'swagger-typescript-api';
import { parseParamRef } from './parse-param-ref.js';
import type { OpenAPIParameter, OpenAPISchema } from './types.js';

/** Resolve operation header parameters, including component parameter refs. */
export function resolveHeaderParameters(
  operation: ParsedRoute['raw'] | null,
  componentsParameters: Record<string, OpenAPIParameter> | null,
): Array<{ name: string; required: boolean; schema: OpenAPISchema }> {
  const params = operation?.parameters;
  if (!Array.isArray(params) || !params.length) return [];

  return params.flatMap((p) => {
    let param: OpenAPIParameter = p as OpenAPIParameter;
    if ('$ref' in p && p.$ref && componentsParameters) {
      const key = parseParamRef(p.$ref);
      if (key && key in componentsParameters) {
        param = componentsParameters[key] as OpenAPIParameter;
      }
    }
    if (param.in !== 'header' || !param.name) return [];
    return [
      {
        name: param.name,
        required: param.required === true,
        schema: param.schema ?? {
          type: param.type ?? 'string',
          format: param.format,
          items: param.items,
        },
      },
    ];
  });
}
