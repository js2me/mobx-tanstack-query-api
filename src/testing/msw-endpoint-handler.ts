import type { AnyEndpoint } from 'mobx-tanstack-query-api';
import { type HttpHandler, type HttpResponseResolver, http } from 'msw';
import type { InferEndpointMswSuccessBody } from './msw-endpoint-response.js';
import { mswEndpointResponse } from './msw-endpoint-response.js';
import { mswPathPattern } from './msw-path-pattern.js';
import { testingDefaults } from './testing-defaults.js';

/**
 * MSW HTTP handler created by {@link mswEndpointHandler}, with the source **endpoint**
 * attached for introspection (e.g. test utilities, logging).
 */
export interface MswEndpointHttpHandler extends HttpHandler {
  endpoint: AnyEndpoint;
}

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

/**
 * Request context MSW passes to {@link mswEndpointHandler} (same shape as `http.get` / `http.post`
 * resolvers).
 */
export type MswEndpointHandlerResolverInfo =
  Parameters<HttpResponseResolver>[0];

/**
 * Success payload allowed from a shorthand resolver: endpoint **`TData`**, or **`ArrayBuffer`**
 * plus **`ArrayBufferView`** when **`TData`** is **`ArrayBuffer`** (same as **`fetch`** / MSW).
 */
export type MswEndpointResolverValue<TEndpoint extends AnyEndpoint> = [
  InferEndpointMswSuccessBody<NoInfer<TEndpoint>>,
] extends [ArrayBuffer]
  ? ArrayBuffer | ArrayBufferView
  : InferEndpointMswSuccessBody<NoInfer<TEndpoint>>;

/**
 * Shorthand resolver: return **`Response`** as-is, or any value the **`fetch` `Response`**
 * constructor accepts as **`body`** (`Blob`, `ArrayBuffer`, typed arrays, **`ReadableStream`**,
 * **`FormData`**, **`URLSearchParams`**, string), plus JSON-serialisable values (objects,
 * arrays, primitives) which are sent with **`Response.json`** and the same default status as
 * {@link mswEndpointResponse}.
 *
 * **`NoInfer`** on the endpoint type parameter ensures **`TEndpoint`** is inferred from the
 * **endpoint** only, not from the resolver’s return type (so a wrong primitive/object body is a
 * type error).
 */
export type MswEndpointBodyResolver<TEndpoint extends AnyEndpoint> = (
  info: MswEndpointHandlerResolverInfo,
) =>
  | MswEndpointResolverValue<TEndpoint>
  | Promise<MswEndpointResolverValue<TEndpoint>>
  | Response
  | Promise<Response>;

/** Same as {@link MswEndpointBodyResolver} (kept for named imports that predate the rename). */
export type MswEndpointJsonResolver<TEndpoint extends AnyEndpoint> =
  MswEndpointBodyResolver<TEndpoint>;

function isReadableStream(value: unknown): value is ReadableStream {
  return (
    typeof ReadableStream !== 'undefined' && value instanceof ReadableStream
  );
}

/**
 * Turns a shorthand return value into an MSW **`Response`**: binary and **`BodyInit`** kinds use
 * **`new Response`**, everything else **`Response.json`** via {@link mswEndpointResponse}.
 */
function mswEndpointShorthandToResponse(
  endpoint: AnyEndpoint,
  data: unknown,
): Response {
  const status = testingDefaults.successStatus;

  if (data instanceof FormData) {
    return new Response(data, { status });
  }
  if (data instanceof URLSearchParams) {
    return new Response(data, {
      status,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
    });
  }
  if (isReadableStream(data)) {
    return new Response(data, { status });
  }
  if (data instanceof Blob) {
    return new Response(data, { status });
  }
  if (data instanceof ArrayBuffer) {
    return new Response(data, { status });
  }
  if (ArrayBuffer.isView(data)) {
    return new Response(data as BodyInit, { status });
  }

  return mswEndpointResponse(endpoint, data as never);
}

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
      'mswEndpointHandler: `configuration.params` must return a non-empty string `method` (as generated endpoints do).',
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
 * The **resolver** matches MSW’s `(info) => …` shape. Return a **`Response`** (e.g.
 * {@link mswEndpointResponse}, `Response.json`, MSW `HttpResponse.json`) or **data** typed from the
 * endpoint’s success **`HttpResponse`**: JSON values go through **`Response.json`**; **`Blob`**,
 * **`ArrayBuffer`**, typed arrays, **`ReadableStream`**, **`FormData`**, **`URLSearchParams`**, and
 * strings use **`new Response`** as appropriate.
 *
 * Requires **`msw`** to be installed in your project.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/msw-endpoint-handler.html)
 */
export function mswEndpointHandler<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  resolver: MswEndpointBodyResolver<NoInfer<TEndpoint>>,
): MswEndpointHttpHandler;
export function mswEndpointHandler(
  endpoint: AnyEndpoint,
  resolver: MswEndpointBodyResolver<AnyEndpoint>,
): MswEndpointHttpHandler {
  const method = inferMswMethodFromEndpoint(endpoint);
  const path = mswPathPattern(endpoint);
  const wrapped = async (info: MswEndpointHandlerResolverInfo) => {
    const out = await resolver(info);
    if (out instanceof Response) {
      return out;
    }
    return mswEndpointShorthandToResponse(endpoint, out);
  };
  const base = (http as any)[method as any](path, wrapped) as HttpHandler;
  return Object.assign(base, { endpoint });
}
