import type { HttpClient } from 'mobx-tanstack-query-api';
import { type MockInstance, vi } from 'vitest';
import {
  createMockHttpClientRequestHandler,
  type MockHttpClientOutput,
} from './utils/mock-http-client-request-handler.js';

/**
 * Supplies mock responses for each `httpClient.request` call in order.
 * After the list is exhausted, further calls use the real client (e.g. `fetch`).
 *
 * The **next** call to **`httpClient.request`** consumes the **next** output, no matter
 * which endpoint triggered it. For **per-endpoint** sequencing, prefer
 * {@link mockEndpointRequestSequence}.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/mock-http-client-request-sequence.html)
 */
export function mockHttpClientRequestSequence<
  TData = unknown,
  TError = unknown,
>(
  httpClient: HttpClient,
  outputs: MockHttpClientOutput<TData, TError>[],
): MockInstance<HttpClient['request']> {
  const invokeRealRequest = httpClient.request.bind(httpClient);
  let index = 0;
  const spy = vi.spyOn(httpClient, 'request');
  spy.mockImplementation(((fullParams: unknown, endpoint?: unknown) => {
    const output = outputs[index++];
    if (output !== undefined) {
      return createMockHttpClientRequestHandler(httpClient, output)(fullParams);
    }
    return invokeRealRequest(fullParams as any, endpoint as any);
  }) as HttpClient['request']);
  return spy;
}
