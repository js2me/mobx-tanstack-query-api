import './vitest-test-helpers.js';
import { describe, expect, it } from 'vitest';
import { captureInvalidations } from './capture-invalidations.js';
import { createTestEndpoint } from './vitest-test-helpers.js';

describe('captureInvalidations', () => {
  it('calls and last reflect invalidateQuery filters', () => {
    const cap = captureInvalidations();
    const { endpoint } = createTestEndpoint({ queryClient: cap.queryClient });

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
    const cap = captureInvalidations();
    const { endpoint } = createTestEndpoint({ queryClient: cap.queryClient });
    const next = cap.waitNext();
    endpoint.invalidateQuery({ id: 3 });
    const recorded = await next;
    expect(recorded.filters.exact).toBe(true);
    expect(recorded.filters.queryKey).toContainEqual('getItem');
    expect(recorded.filters.queryKey).toContainEqual({ id: 3 });
    cap.restore();
  });
});
