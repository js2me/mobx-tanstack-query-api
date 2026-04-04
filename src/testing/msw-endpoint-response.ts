import type {
  AnyEndpoint,
  HttpResponse,
  InferEndpointData,
} from 'mobx-tanstack-query-api';

/**
 * Success JSON body type for {@link mswEndpointResponse}: what the runtime client assigns to
 * `HttpResponse.data` for this endpoint’s declared response type.
 */
export type InferEndpointMswSuccessBody<TEndpoint extends AnyEndpoint> =
  InferEndpointData<TEndpoint> extends HttpResponse<infer TData, any, any>
    ? TData
    : unknown;

/**
 * Error JSON body type for {@link mswEndpointErrorResponse}: what the client parses into
 * `HttpResponse.error` on non-OK responses.
 */
export type InferEndpointMswErrorBody<TEndpoint extends AnyEndpoint> =
  InferEndpointData<TEndpoint> extends HttpResponse<any, infer TError, any>
    ? TError
    : unknown;

/**
 * Builds a **`Response`** for MSW resolvers with **`data`** typed from the **endpoint**’s
 * `HttpResponse` generic (same idea as {@link InferEndpointMswSuccessBody}).
 *
 * The first argument is only used for **type inference**; pass the same endpoint instance as in
 * {@link mswEndpointHandler}.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/msw-endpoint-response.html)
 */
export function mswEndpointResponse<TEndpoint extends AnyEndpoint>(
  _endpoint: TEndpoint,
  data: InferEndpointMswSuccessBody<TEndpoint>,
  init?: ResponseInit,
): Response {
  return Response.json(data, {
    ...init,
    status: init?.status ?? 200,
  });
}

/**
 * Same as {@link mswEndpointResponse} but for **error** payloads; default **`status`** is **400**
 * (override with **`init.status`**).
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/msw-endpoint-response.html)
 */
export function mswEndpointErrorResponse<TEndpoint extends AnyEndpoint>(
  _endpoint: TEndpoint,
  error: InferEndpointMswErrorBody<TEndpoint>,
  init?: ResponseInit,
): Response {
  return Response.json(error, {
    ...init,
    status: init?.status ?? 400,
  });
}
