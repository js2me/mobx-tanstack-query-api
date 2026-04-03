import type { AnyEndpoint, InferEndpointData } from 'mobx-tanstack-query-api';
import { type MockInstance, vi } from 'vitest';
import { mockHttpClientRequestOnce } from './mock-http-client-request-once.js';
import type { MockHttpClientOutput } from './utils/mock-http-client-request-handler.js';

/**
 * Only the first `endpoint.request` is paired with {@link mockHttpClientRequestOnce}; later calls use the real client.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/vitest/#mockendpointrequest-mockendpointrequestonce)
 */
export const mockEndpointRequestOnce = <TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  output: MockHttpClientOutput<
    InferEndpointData<TEndpoint>['data'],
    InferEndpointData<TEndpoint>['error']
  >,
): MockInstance<TEndpoint['request']> => {
  const invokeRealRequest = endpoint.request.bind(endpoint);

  const spy = vi.spyOn(endpoint, 'request' as any);
  // Endpoint is callable + methods; Vitest's spy typing does not model that intersection.
  (spy as any).mockImplementationOnce((...args: any[]) => {
    mockHttpClientRequestOnce(endpoint.httpClient, output);
    return invokeRealRequest(...args);
  });

  return spy as MockInstance<TEndpoint['request']>;
};
