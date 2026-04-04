import './vitest-test-helpers.js';
import { describe, expect, it, vi } from 'vitest';
import { EndpointQueryClient } from '../runtime/endpoint-query-client.js';
import { captureEndpointRequestParams } from './capture-endpoint-request-params.js';
import { createTestEndpoint } from './vitest-test-helpers.js';

describe('captureEndpointRequestParams', () => {
  it('calls and last reflect FullRequestParams', async () => {
    const queryClient = new EndpointQueryClient();
    const { endpoint, fetchMock } = createTestEndpoint({ queryClient });
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
    const queryClient = new EndpointQueryClient();
    const { endpoint, fetchMock } = createTestEndpoint({ queryClient });
    const cap = captureEndpointRequestParams(endpoint);
    await expect(
      cap.withNextRequest(() => endpoint.request({ id: 3 })),
    ).rejects.toThrow('fetch must not be called');
    expect(cap.last?.path).toBe('/items/3');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    cap.restore();
  });

  it('abortSignal restores the spy when aborted', () => {
    const queryClient = new EndpointQueryClient();
    const { endpoint } = createTestEndpoint({ queryClient });
    const ac = new AbortController();
    captureEndpointRequestParams(endpoint, ac.signal);
    expect(vi.isMockFunction(endpoint.request)).toBe(true);
    ac.abort();
    expect(vi.isMockFunction(endpoint.request)).toBe(false);
  });
});
