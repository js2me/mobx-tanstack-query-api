import type { HttpClient } from 'mobx-tanstack-query-api';
import { type MockInstance, vi } from 'vitest';
import {
  createMockHttpClientRequestHandler,
  type MockHttpClientOutput,
} from './utils/mock-http-client-request-handler.js';

/**
 * Stubs {@link HttpClient.request} until the spy is restored: same payload on every call.
 *
 * For `error`, throws the `HttpResponse`, matching the real client when `!ok` / `error`.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/mock-http-client-request.html)
 */
export function mockHttpClientRequest<TData = unknown, TError = unknown>(
  httpClient: HttpClient,
  output: MockHttpClientOutput<TData, TError>,
): MockInstance<HttpClient['request']> {
  return vi
    .spyOn(httpClient, 'request')
    .mockImplementation(createMockHttpClientRequestHandler(httpClient, output));
}
