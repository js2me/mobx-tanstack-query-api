import './vitest-test-helpers.js';
import { describe, expect, it } from 'vitest';
import { EndpointQueryClient } from '../runtime/endpoint-query-client.js';
import { mockEndpointRequestSequence } from './mock-endpoint-request-sequence.js';
import { createTestEndpoint } from './vitest-test-helpers.js';

describe('mockEndpointRequestSequence', () => {
  it('three mocked responses in order, fourth hits fetch', async () => {
    const queryClient = new EndpointQueryClient();
    const { endpoint, fetchMock } = createTestEndpoint({ queryClient });
    const spy = mockEndpointRequestSequence(endpoint, [
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

  it('empty outputs array — no HttpClient mocks', async () => {
    const queryClient = new EndpointQueryClient();
    const { endpoint, fetchMock } = createTestEndpoint({ queryClient });
    const spy = mockEndpointRequestSequence(endpoint, []);
    await expect(endpoint.request({ id: 1 })).rejects.toThrow(
      'fetch must not be called',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
