import './vitest-test-helpers.js';
import { describe, expect, it } from 'vitest';
import { captureEndpointRequestParams } from './capture-endpoint-request-params.js';
import { createTestEndpoint } from './vitest-test-helpers.js';

describe('captureEndpointRequestParams', () => {
  it('calls and last reflect FullRequestParams', async () => {
    const { endpoint, fetchMock } = createTestEndpoint();
    const cap = captureEndpointRequestParams(endpoint);
    await expect(endpoint.request({ id: 7 })).rejects.toThrow(
      'fetch must not be called',
    );
    expect(cap.calls).toHaveLength(1);
    expect(cap.last?.path).toBe('/items/7');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    cap.restore();
  });

  it('waitNext resolves on the next call', async () => {
    const { endpoint, fetchMock } = createTestEndpoint();
    const cap = captureEndpointRequestParams(endpoint);
    const next = cap.waitNext();
    const p = endpoint.request({ id: 3 });
    await expect(next).resolves.toMatchObject({ path: '/items/3' });
    await expect(p).rejects.toThrow('fetch must not be called');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    cap.restore();
  });
});
