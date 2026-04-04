import type { AnyEndpoint } from 'mobx-tanstack-query-api';
import { type HttpHandler, http } from 'msw';
import { mswPathPattern } from './msw-path-pattern.js';

/**
 * MSW `http` method names supported by {@link mswEndpointHandler}.
 */
export type MswEndpointHandlerMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'patch'
  | 'delete'
  | 'options'
  | 'head';

const MSW_METHODS = new Set<string>([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
]);

function inferMswMethodFromEndpoint(
  endpoint: AnyEndpoint,
): MswEndpointHandlerMethod {
  const full = endpoint.configuration.params({} as Record<string, never>);
  const raw = full.method;
  if (typeof raw !== 'string' || !raw) {
    throw new TypeError(
      'mswEndpointHandler: `configuration.params` must return a non-empty string `method` (as generated endpoints do). Pass the optional third argument to override.',
    );
  }
  const lower = raw.toLowerCase();
  if (!MSW_METHODS.has(lower)) {
    throw new Error(
      `mswEndpointHandler: HTTP method "${raw}" is not supported by MSW \`http.*\` handlers.`,
    );
  }
  return lower as MswEndpointHandlerMethod;
}

/**
 * Registers an MSW handler for the given **endpoint**: URL from {@link mswPathPattern},
 * HTTP verb from **`configuration.params({}).method`** (same as codegen).
 *
 * The **resolver** is the same callback you would pass to `http.get` / `http.post` / etc.
 *
 * If inference fails (custom `params`, unsupported verb), pass **`methodOverride`** as the
 * third argument.
 *
 * Requires **`msw`** to be installed in your project.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/msw-endpoint-handler.html)
 */
export function mswEndpointHandler(
  endpoint: AnyEndpoint,
  resolver: Parameters<typeof http.get>[1],
  methodOverride?: MswEndpointHandlerMethod,
): HttpHandler {
  const method = methodOverride ?? inferMswMethodFromEndpoint(endpoint);
  const path = mswPathPattern(endpoint);
  switch (method) {
    case 'get':
      return http.get(path, resolver as Parameters<typeof http.get>[1]);
    case 'post':
      return http.post(path, resolver as Parameters<typeof http.post>[1]);
    case 'put':
      return http.put(path, resolver as Parameters<typeof http.put>[1]);
    case 'patch':
      return http.patch(path, resolver as Parameters<typeof http.patch>[1]);
    case 'delete':
      return http.delete(path, resolver as Parameters<typeof http.delete>[1]);
    case 'options':
      return http.options(path, resolver as Parameters<typeof http.options>[1]);
    case 'head':
      return http.head(path, resolver as Parameters<typeof http.head>[1]);
    default: {
      const _exhaustive: never = method;
      return _exhaustive;
    }
  }
}
