import { parseComponentRef } from './parse-component-ref.js';

export function parseResponseRef(ref: string): string | null {
  const parsed = parseComponentRef(ref);
  return parsed?.name ?? null;
}
