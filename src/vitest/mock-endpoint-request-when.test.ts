import './vitest-test-helpers.js';
import { describe, expect, it } from 'vitest';
import { mockEndpointRequestWhen } from './mock-endpoint-request-when.js';
import { createTestEndpoint } from './vitest-test-helpers.js';

describe('mockEndpointRequestWhen', () => {
  it('when match is true, mocks response; otherwise uses fetch', async () => {
    const { endpoint, fetchMock } = createTestEndpoint();
    const spy = mockEndpointRequestWhen(endpoint, (p) => p.id >= 100, {
      success: { value: 'vip' },
    });
    await expect(endpoint.request({ id: 1 })).rejects.toThrow(
      'fetch must not be called',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(endpoint.request({ id: 100 })).resolves.toMatchObject({
      data: { value: 'vip' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
