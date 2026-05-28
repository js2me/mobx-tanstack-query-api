import { parseComponentRef } from './parse-component-ref.js';

export const REF_PREFIX_PARAMS = '#/components/parameters/';

export function parseParamRef(ref: string): string | null {
  const parsed = parseComponentRef(ref);
  if (parsed?.section !== 'parameters') return null;
  return parsed.name;
}
