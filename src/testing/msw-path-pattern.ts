import type { AnyEndpoint } from 'mobx-tanstack-query-api';

function segmentsToMswPathname(segments: string[]): string {
  return segments
    .map((segment) => {
      if (segment.startsWith('{') && segment.endsWith('}')) {
        return `:${segment.slice(1, -1)}`;
      }
      return segment;
    })
    .join('/');
}

function joinBaseUrlAndPathname(baseUrl: string, pathname: string): string {
  const trimmedPath = pathname.replace(/^\/+/u, '');
  const trimmedBase = baseUrl.trim();
  if (!trimmedBase) {
    return trimmedPath ? `/${trimmedPath}` : '/';
  }
  const baseNoTrailingSlash = trimmedBase.replace(/\/+$/u, '');
  return `${baseNoTrailingSlash}/${trimmedPath}`;
}

/**
 * Returns a URL string suitable as the first argument to MSW’s `http.*` handlers:
 * the endpoint’s `httpClient.baseUrl` plus `configuration.path`, with `{param}`
 * segments turned into `:param` (MSW path parameters).
 *
 * Does not include query strings. If your `params()` adds a prefix not reflected in
 * `configuration.path`, adjust the pattern manually.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/msw-path-pattern.html)
 */
export function mswPathPattern(endpoint: AnyEndpoint): string {
  const pathname = segmentsToMswPathname(endpoint.configuration.path);
  return joinBaseUrlAndPathname(endpoint.httpClient.baseUrl, pathname);
}
