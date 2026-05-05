import type { ParsedRoute } from 'swagger-typescript-api';
import { parseComponentRef } from '../../../utils/swagger/parse-component-ref.js';
import { parseRef } from '../../../utils/swagger/parse-ref.js';

/*


  if (!responseSchemaKey && componentsSchemas && configuration.modelTypes) {
    const aliasType = configuration.modelTypes.find(
      (m: AnyObject) => m.name === defaultOkResponse,
    );
    if (
      aliasType?.typeIdentifier === 'type' &&
      typeof aliasType.content === 'string' &&
      /^[A-Za-z0-9_]+$/.test(aliasType.content.trim())
    ) {
      const resolved = typeNameToSchemaKey(
        aliasType.content.trim(),
        dataContractTypeSuffix,
      );
      if (resolved in componentsSchemas) responseSchemaKey = resolved;
    }
  }
  if (!responseSchemaKey && componentsSchemas) {
    const match = defaultOkResponse.match(/^Get(.+)DataDC$/);
    if (match) {
      const candidate = match[1];
      if (candidate in componentsSchemas) responseSchemaKey = candidate;
    }
  }

*/

/**
 * Extract OpenAPI schema key from response $ref (e.g. from responses['200'].content['application/json'].schema.$ref).
 * Use this for the data contract so we resolve the actual schema (e.g. GoldenApple) instead of the alias type name (GetGoldenAppleDataDC).
 */
export function getResponseSchemaRef(route: ParsedRoute): string | null {
  const responses = route.raw?.responses;

  if (!responses || typeof responses !== 'object') {
    return null;
  }

  const successStatus = Object.keys(responses).find((s) => {
    const code = Number.parseInt(s, 10);
    return code >= 200 && code < 300;
  });

  if (!successStatus) {
    return null;
  }

  const successResponse = responses[successStatus] as
    | {
        content?: Record<string, { schema?: { $ref?: string } }>;
      }
    | undefined;
  const content = successResponse?.content;

  if (!content || typeof content !== 'object') {
    return null;
  }

  const jsonContent = content['application/json'] ?? Object.values(content)[0];
  return typeof jsonContent?.schema?.$ref === 'string'
    ? jsonContent.schema.$ref
    : null;
}

export function hasResponseComponentRef(route: ParsedRoute): boolean {
  const ref = getResponseSchemaRef(route);
  const parsed = ref != null ? parseComponentRef(ref) : null;
  return parsed != null && parsed.section !== 'schemas';
}

export function getResponseSchemaKey(route: ParsedRoute): string | null {
  const ref = getResponseSchemaRef(route);
  if (ref == null) {
    return null;
  }
  return parseRef(ref);
}
