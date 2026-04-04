import './vitest-test-helpers.js';
import { describe, expect, it, vi } from 'vitest';
import { EndpointQueryClient } from '../runtime/endpoint-query-client.js';
import { stubEndpointThrow } from './stub-endpoint-throw.js';
import { createTestEndpoint } from './vitest-test-helpers.js';

describe('stubEndpointThrow', () => {
  it('defaults to one rejection, then the real request', async () => {
    const queryClient = new EndpointQueryClient();
    const { endpoint, fetchMock } = createTestEndpoint({ queryClient });
    const err = new Error('network');
    const spy = stubEndpointThrow(endpoint, err);
    await expect(endpoint.request({ id: 1 })).rejects.toBe(err);
    await expect(endpoint.request({ id: 2 })).rejects.toThrow(
      'fetch must not be called',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('factory may return a Promise', async () => {
    const queryClient = new EndpointQueryClient();
    const { endpoint } = createTestEndpoint({ queryClient });
    const spy = stubEndpointThrow(endpoint, async () => new Error('async-err'));
    await expect(endpoint.request({ id: 1 })).rejects.toThrow('async-err');
    spy.mockRestore();
  });

  it('persistent: every call throws', async () => {
    const queryClient = new EndpointQueryClient();
    const { endpoint } = createTestEndpoint({ queryClient });
    const spy = stubEndpointThrow(endpoint, new Error('p'), {
      persistent: true,
    });
    await expect(endpoint.request({ id: 1 })).rejects.toThrow('p');
    await expect(endpoint.request({ id: 2 })).rejects.toThrow('p');
    spy.mockRestore();
  });

  it('abortSignal restores the spy when aborted', () => {
    const queryClient = new EndpointQueryClient();
    const { endpoint } = createTestEndpoint({ queryClient });
    const ac = new AbortController();
    stubEndpointThrow(endpoint, new Error('x'), { abortSignal: ac.signal });
    expect(vi.isMockFunction(endpoint.request)).toBe(true);
    ac.abort();
    expect(vi.isMockFunction(endpoint.request)).toBe(false);
  });
});
