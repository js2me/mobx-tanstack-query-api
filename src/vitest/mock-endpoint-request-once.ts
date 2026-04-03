import { type MockInstance, vi } from 'vitest';
import type {
  AnyEndpoint,
  InferEndpointData,
} from '../runtime/endpoint.types.js';
import { mockHttpClientRequestOnce } from './mock-http-client-request-once.js';
import type { MockHttpClientOutput } from './utils/mock-http-client-request-handler.js';

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
