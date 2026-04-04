import './vitest-test-helpers.js';
import { describe, expect, it, vi } from 'vitest';
import { EndpointQueryClient } from '../runtime/endpoint-query-client.js';
import { captureInvalidations } from './capture-invalidations.js';
import { createTestEndpoint } from './vitest-test-helpers.js';

describe('captureInvalidations', () => {
  it('calls and last reflect invalidateQuery filters', () => {
    const queryClient = new EndpointQueryClient();
    const cap = captureInvalidations(queryClient);
    const { endpoint } = createTestEndpoint({ queryClient });

    endpoint.invalidateQuery({ id: 7 });

    expect(cap.calls).toHaveLength(1);
    expect(cap.last?.filters.exact).toBe(true);
    expect(cap.last?.filters.queryKey?.slice(0, 4)).toEqual([
      'items',
      '{id}',
      'getItem',
      { id: 7 },
    ]);
    cap.restore();
  });

  it('waitNext resolves on the next invalidation', async () => {
    const queryClient = new EndpointQueryClient();
    const cap = captureInvalidations(queryClient);
    const { endpoint } = createTestEndpoint({ queryClient });
    const next = cap.waitNext();
    endpoint.invalidateQuery({ id: 3 });
    const recorded = await next;
    expect(recorded.filters.exact).toBe(true);
    expect(recorded.filters.queryKey).toContainEqual('getItem');
    expect(recorded.filters.queryKey).toContainEqual({ id: 3 });
    cap.restore();
  });

  it('abortSignal restores the spy when aborted', () => {
    const queryClient = new EndpointQueryClient();
    const ac = new AbortController();
    captureInvalidations(queryClient, ac.signal);
    expect(vi.isMockFunction(queryClient.invalidateQueries)).toBe(true);
    ac.abort();
    expect(vi.isMockFunction(queryClient.invalidateQueries)).toBe(false);
  });
});
