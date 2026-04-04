import type { AnyEndpoint, InferEndpointData } from 'mobx-tanstack-query-api';
import { type MockInstance, vi } from 'vitest';
import { mockHttpClientRequestOnce } from './mock-http-client-request-once.js';
import type { MockHttpClientOutput } from './utils/mock-http-client-request-handler.js';

/**
 * Each `endpoint.request` queues a one-time {@link mockHttpClientRequestOnce} on that endpoint’s client with the same `output`.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/vitest/mock-endpoint-request.html)
 */
export const mockEndpointRequest = <TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  output: MockHttpClientOutput<
    InferEndpointData<TEndpoint>['data'],
    InferEndpointData<TEndpoint>['error']
  >,
): MockInstance<TEndpoint['request']> => {
  const invokeRealRequest = endpoint.request.bind(endpoint);

  const spy = vi.spyOn(endpoint, 'request' as any);
  // Endpoint is callable + methods; Vitest's spy typing does not model that intersection.
  (spy as any).mockImplementation((...args: any[]) => {
    mockHttpClientRequestOnce(endpoint.httpClient, output);
    return invokeRealRequest(...args);
  });

  return spy as MockInstance<TEndpoint['request']>;
};
