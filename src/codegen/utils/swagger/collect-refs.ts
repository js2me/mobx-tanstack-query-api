import { parseRef } from './parse-ref.js';
import type { OpenAPISchema } from './types.js';

/**
 * Collect all schema keys referenced from this schema (transitively).
 */
export function collectRefs(
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
