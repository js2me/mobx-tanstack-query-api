import type { GenerateQueryApiParams } from '../types/generate-query-api-params.js';

import { resolveGeneratedModuleSpecifier } from './generate-import.js';

export type GenerateExportVariants =
  | { asteriksAt: string }
  | { asteriks: true };

/**
 * Emits `export * as … from '…';` or `export * from '…';` (when `variants.asteriks`)
 * using the same relative-path rules as {@link generateImport}.
 */
export function generateExport(
  variants: GenerateExportVariants,
  from: string,
  codegenParams: GenerateQueryApiParams,
): string {
  const resolved = resolveGeneratedModuleSpecifier(
    from,
    codegenParams.moduleResolution,
  );
  if ('asteriksAt' in variants) {
    return `export * as ${variants.asteriksAt} from '${resolved}';`;
  }
  return `export * from '${resolved}';`;
}
