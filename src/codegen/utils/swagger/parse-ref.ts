import { parseComponentRef } from './parse-component-ref.js';

export const REF_PREFIX = '#/components/schemas/';

export function parseRef(ref: string): string | null {
  const parsed = parseComponentRef(ref);
  if (parsed?.section !== 'schemas') return null;
  return parsed.name;
}
