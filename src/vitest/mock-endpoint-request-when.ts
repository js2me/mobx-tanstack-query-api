import { type MockInstance, vi } from 'vitest';
import type {
  AnyEndpoint,
  InferEndpointData,
  InferEndpointInput,
} from '../runtime/endpoint.types.js';
import { mockHttpClientRequestOnce } from './mock-http-client-request-once.js';
import type { MockHttpClientOutput } from './utils/mock-http-client-request-handler.js';

/**
 * Stubs `HttpClient.request` only when `match` returns true for the `endpoint.request` input.
 * Otherwise the real request path runs.
 */
export function mockEndpointRequestWhen<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  match: (params: InferEndpointInput<TEndpoint>) => boolean,
  output: MockHttpClientOutput<
    InferEndpointData<TEndpoint>['data'],
    InferEndpointData<TEndpoint>['error']
  >,
): MockInstance<TEndpoint['request']> {
  const invokeRealRequest = endpoint.request.bind(endpoint);
  const spy = vi.spyOn(endpoint, 'request' as any);
  (spy as any).mockImplementation((...args: any[]) => {
    const params = (args[0] ?? {}) as InferEndpointInput<TEndpoint>;
    if (match(params)) {
      mockHttpClientRequestOnce(endpoint.httpClient, output);
    }
    return invokeRealRequest(...args);
  });
  return spy as MockInstance<TEndpoint['request']>;
}
