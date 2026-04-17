import { typeGuard } from 'yummies/type-guard';

export function overrideRequestParamsToSpreadLine(
  value: unknown,
): string | null {
  if (typeof value === 'string') {
    return value.trim() === '' ? null : `...(${value}),`;
  }
  if (!typeGuard.isObject(value) || Object.keys(value).length === 0) {
    return null;
  }
  return `...(${JSON.stringify(value)}),`;
}
