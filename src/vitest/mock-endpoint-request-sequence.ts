import { type MockInstance, vi } from 'vitest';
import type {
  AnyEndpoint,
  InferEndpointData,
} from '../runtime/endpoint.types.js';
import { mockHttpClientRequestOnce } from './mock-http-client-request-once.js';
import type { MockHttpClientOutput } from './utils/mock-http-client-request-handler.js';

/**
 * Supplies mock responses for each `endpoint.request` call in order.
 * After the list is exhausted, further calls use the real client (e.g. `fetch`).
 */
export function mockEndpointRequestSequence<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  outputs: MockHttpClientOutput<
    InferEndpointData<TEndpoint>['data'],
    InferEndpointData<TEndpoint>['error']
  >[],
): MockInstance<TEndpoint['request']> {
  const invokeRealRequest = endpoint.request.bind(endpoint);
  let index = 0;
  const spy = vi.spyOn(endpoint, 'request' as any);
  (spy as any).mockImplementation((...args: any[]) => {
    const output = outputs[index++];
    if (output !== undefined) {
      mockHttpClientRequestOnce(endpoint.httpClient, output);
    }
    return invokeRealRequest(...args);
  });
  return spy as MockInstance<TEndpoint['request']>;
}
