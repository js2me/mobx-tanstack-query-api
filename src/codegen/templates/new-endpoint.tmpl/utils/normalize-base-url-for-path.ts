export function normalizeBaseUrlForPath(baseUrl: string, path: string): string {
  if (baseUrl === '') {
    return '';
  }
  if (baseUrl.endsWith('/') && path.startsWith('/')) {
    return baseUrl.slice(0, -1);
  }
  return baseUrl;
}
