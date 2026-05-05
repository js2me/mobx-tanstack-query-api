import type { AnyObject } from 'yummies/types';

/**
 * Collect names of every component declared in the OpenAPI spec across all
 * sections (`schemas`, `responses`, custom sections like `lols`, etc).
 *
 * Names are formatted with {@link formatModelName} to match how STA exposes
 * them in `modelTypes` (i.e. with the `dataContractTypeSuffix` applied).
 *
 * Important: this only includes components that **explicitly exist** in the
 * source spec — STA's auto‑extracted operation‑level aliases
 * (e.g. `<Op>Data = <Resp>` produced by `extractResponseBody`) are NOT here,
 * because they live as virtual schemas inside STA's internal map and must
 * stay local to the endpoint file per project rule.
 */
export function collectComponentContractNames(
  swaggerSchema: AnyObject | undefined,
  formatModelName: (name: string) => string,
): Set<string> {
  const result = new Set<string>();
  const components = (swaggerSchema as AnyObject | undefined)?.components as
    | Record<string, AnyObject>
    | undefined;

  if (!components || typeof components !== 'object') {
    return result;
  }

  for (const sectionName of Object.keys(components)) {
    const section = components[sectionName];
    if (!section || typeof section !== 'object') {
      continue;
    }
    for (const componentName of Object.keys(section)) {
      const formatted = formatModelName(componentName);
      if (typeof formatted === 'string') {
        result.add(formatted);
      }
    }
  }

  return result;
}
