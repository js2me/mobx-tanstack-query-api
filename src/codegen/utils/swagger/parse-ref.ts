export const REF_PREFIX = '#/components/schemas/';

export function parseRef(ref: string): string | null {
  if (typeof ref !== 'string' || !ref.startsWith(REF_PREFIX)) return null;
  return ref.slice(REF_PREFIX.length);
}
