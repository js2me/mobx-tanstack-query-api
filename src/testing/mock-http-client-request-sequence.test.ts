import './vitest-test-helpers.js';
import { describe, expect, it } from 'vitest';
import { EndpointQueryClient } from '../runtime/endpoint-query-client.js';
import { mockHttpClientRequestSequence } from './mock-http-client-request-sequence.js';
import {
  createTestEndpoint,
  createThreeEndpointsOnSharedClient,
} from './vitest-test-helpers.js';

describe('mockHttpClientRequestSequence', () => {
  it('three mocked responses in order, fourth hits fetch', async () => {
    const queryClient = new EndpointQueryClient();
    const { endpoint, httpClient, fetchMock } = createTestEndpoint({
      queryClient,
    });
    const spy = mockHttpClientRequestSequence(httpClient, [
      { success: { value: 's1' } },
      { success: { value: 's2' } },
      { success: { value: 's3' } },
    ]);
    await expect(endpoint.request({ id: 1 })).resolves.toMatchObject({
      data: { value: 's1' },
    });
    await expect(endpoint.request({ id: 2 })).resolves.toMatchObject({
      data: { value: 's2' },
    });
    await expect(endpoint.request({ id: 3 })).resolves.toMatchObject({
      data: { value: 's3' },
    });
    await expect(endpoint.request({ id: 4 })).rejects.toThrow(
      'fetch must not be called',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('empty outputs array — every request hits fetch', async () => {
    const queryClient = new EndpointQueryClient();
    const { endpoint, fetchMock } = createTestEndpoint({ queryClient });
    const spy = mockHttpClientRequestSequence(endpoint.httpClient, []);
    await expect(endpoint.request({ id: 1 })).rejects.toThrow(
      'fetch must not be called',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('shared client: outputs consumed across endpoints in call order', async () => {
    const { endpointA, endpointB, endpointC, fetchMock } =
      createThreeEndpointsOnSharedClient();
    const spy = mockHttpClientRequestSequence(endpointA.httpClient, [
      { success: { value: 'a' } },
      { success: { value: 'b' } },
      { success: { value: 'c' } },
    ]);
    await expect(endpointB.request({ id: 1 })).resolves.toMatchObject({
      data: { value: 'a' },
    });
    await expect(endpointC.request({ id: 1 })).resolves.toMatchObject({
      data: { value: 'b' },
    });
    await expect(endpointA.request({ id: 1 })).resolves.toMatchObject({
      data: { value: 'c' },
    });
    await expect(endpointA.request({ id: 2 })).rejects.toThrow(
      'fetch must not be called',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
