import type { HttpClient } from 'mobx-tanstack-query-api';
import { type MockInstance, vi } from 'vitest';
import {
  createMockHttpClientRequestHandler,
  type MockHttpClientOutput,
} from './utils/mock-http-client-request-handler.js';

/**
 * Stubs a single {@link HttpClient.request} call: builds a response like the runtime
 * (`createResponse` / `resolveBody`) without hitting `fetch`.
 *
 * For `error`, throws the `HttpResponse`, matching the real client when `!ok` / `error`.
 *
 * If several endpoints share one `HttpClient`, `mockImplementationOnce` applies to the
 * next request on that client regardless of endpoint — prefer `mockEndpointRequestOnce`
 * or compose your own `fetch` via `httpClient.updateConfig({ fetch })`.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/mock-http-client-request-once.html)
 */
export function mockHttpClientRequestOnce<TData = unknown, TError = unknown>(
  httpClient: HttpClient,
  output: MockHttpClientOutput<TData, TError>,
): MockInstance<HttpClient['request']> {
  return vi
    .spyOn(httpClient, 'request')
    .mockImplementationOnce(
      createMockHttpClientRequestHandler(httpClient, output),
    );
}
