import type { MaybeFalsy } from 'yummies/types';

import type { GenerateQueryApiParams } from '../types/generate-query-api-params.js';

/** Relative module specifier for generated TS (optional `.js` for `node16` / `nodenext`). */
export function resolveGeneratedModuleSpecifier(
  from: string,
  params: Pick<GenerateQueryApiParams, 'moduleResolution'>,
): string {
  if (!from.startsWith('.')) {
    return from;
  }
  const root = from.endsWith('.js') ? from.slice(0, -3) : from;

  if (
    params.moduleResolution === 'node16' ||
    params.moduleResolution === 'nodenext'
  ) {
    return `${root}.js`;
  }

  return root;
}

/**
 * Emits `import { … } from "from";` with optional `.js` on relative `from`
 * when `moduleResolution` is `node16` or `nodenext`. Non-relative `from` is left as-is.
 * Falsy entries in `what` are dropped before joining.
 */
export function generateImport(
  what: MaybeFalsy<string>[],
  from: string,
  codegenParams: GenerateQueryApiParams,
): string {
  const bindings = what.filter((x): x is string => Boolean(x)).join(', ');
  const resolved = resolveGeneratedModuleSpecifier(from, codegenParams);
  return `import { ${bindings} } from "${resolved}";`;
}
