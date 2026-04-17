export const REF_PREFIX_PARAMS = '#/components/parameters/';

export function parseParamRef(ref: string): string | null {
  if (typeof ref !== 'string' || !ref.startsWith(REF_PREFIX_PARAMS))
    return null;
  return ref.slice(REF_PREFIX_PARAMS.length);
}
