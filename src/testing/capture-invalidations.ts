import type {
  InvalidateOptions,
  InvalidateQueryFilters,
} from '@tanstack/query-core';
import { type MockInstance, vi } from 'vitest';
import type { EndpointQueryClient } from '../runtime/endpoint-query-client.js';

/**
 * One recorded call to {@link EndpointQueryClient.invalidateQueries}.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/capture-invalidations.html)
 */
export type CaptureInvalidationsCall = {
  filters: InvalidateQueryFilters;
  options?: InvalidateOptions;
};

/**
 * Handle returned by {@link captureInvalidations}.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/capture-invalidations.html)
 */
export type CaptureInvalidationsHandle = {
  /** Every `(filters, options)` passed to `invalidateQueries`. */
  calls: CaptureInvalidationsCall[];
  /** Last entry in {@link calls}. */
  get last(): CaptureInvalidationsCall | undefined;
  /** Resolves on the next `invalidateQueries` with the same payload recorded in {@link calls}. */
  waitNext(): Promise<CaptureInvalidationsCall>;
  /**
   * Minimal stub: use as the `queryClient` wired to codegen-generated endpoints in tests
   * so `invalidateQuery` is recorded. Not a full {@link EndpointQueryClient}.
   */
  queryClient: EndpointQueryClient;
  /** The underlying `vi.fn` used as `invalidateQueries`. */
  mock: MockInstance<
    (
      filters?: InvalidateQueryFilters,
      options?: InvalidateOptions,
    ) => Promise<void>
  >;
  restore: () => void;
};

/**
 * Returns a minimal `EndpointQueryClient`-shaped stub whose `invalidateQueries` records
 * each call. In tests, pass **`queryClient`** as **`cap.queryClient`** when wiring **codegen-generated**
 * endpoints so `invalidateQuery` hits the recorder (see package docs).
 *
 * For integration tests that need a real cache, prefer `vi.spyOn(realClient, 'invalidateQueries')`
 * or assert on `QueryClient` state instead.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/capture-invalidations.html)
 */
export function captureInvalidations(): CaptureInvalidationsHandle {
  const calls: CaptureInvalidationsCall[] = [];
  const waitQueue: Array<(c: CaptureInvalidationsCall) => void> = [];

  const mock = vi.fn(
    (filters?: InvalidateQueryFilters, options?: InvalidateOptions) => {
      const call: CaptureInvalidationsCall = {
        filters: filters ?? {},
        options,
      };
      calls.push(call);
      waitQueue.shift()?.(call);
      return Promise.resolve();
    },
  );

  const queryClient = {
    invalidateQueries: mock,
  } as unknown as EndpointQueryClient;

  return {
    calls,
    get last() {
      return calls.at(-1);
    },
    waitNext: () =>
      new Promise<CaptureInvalidationsCall>((resolve) => {
        waitQueue.push(resolve);
      }),
    queryClient,
    mock,
    restore: () => mock.mockRestore(),
  };
}
