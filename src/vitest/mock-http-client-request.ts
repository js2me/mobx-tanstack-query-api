import { type MockInstance, vi } from 'vitest';
import type { HttpClient } from '../runtime/http-client.js';
import {
  createMockHttpClientRequestHandler,
  type MockHttpClientOutput,
} from './utils/mock-http-client-request-handler.js';

/**
 * Stubs {@link HttpClient.request} until the spy is restored: same payload on every call.
 *
 * For `error`, throws the `HttpResponse`, matching the real client when `!ok` / `error`.
 */
export function mockHttpClientRequest<TData = unknown, TError = unknown>(
  httpClient: HttpClient,
  output: MockHttpClientOutput<TData, TError>,
): MockInstance<HttpClient['request']> {
  return vi
    .spyOn(httpClient, 'request')
    .mockImplementation(createMockHttpClientRequestHandler(httpClient, output));
}
