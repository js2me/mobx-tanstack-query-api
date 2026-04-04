import type {
  InvalidateOptions,
  InvalidateQueryFilters,
} from '@tanstack/query-core';
import { type MockInstance, vi } from 'vitest';
import type { EndpointQueryClient } from '../runtime/endpoint-query-client.js';
import { bindRestoreOnAbortSignal } from './utils/bind-restore-on-abort-signal.js';

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
  /** The same {@link EndpointQueryClient} you passed to {@link captureInvalidations}. */
  queryClient: EndpointQueryClient;
  /** Vitest spy installed on **`queryClient.invalidateQueries`**. */
  mock: MockInstance<
    (
      filters?: InvalidateQueryFilters,
      options?: InvalidateOptions,
    ) => Promise<void>
  >;
  restore: () => void;
};

/**
 * Spies on **`queryClient.invalidateQueries`**, records each **`(filters, options)`**, then
 * delegates to the real implementation so the cache behaves normally.
 *
 * Wire the **same** **`queryClient`** into codegen-generated endpoints (see package docs) so
 * **`endpoint.invalidateQuery`** hits this spy.
 *
 * Pass **`abortSignal`** (e.g. Vitest test context **`signal`**) to call **`restore()`** automatically
 * when the signal aborts (test cancellation).
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/capture-invalidations.html)
 */
export function captureInvalidations(
  queryClient: EndpointQueryClient,
  abortSignal?: AbortSignal,
): CaptureInvalidationsHandle {
  const calls: CaptureInvalidationsCall[] = [];
  const waitQueue: Array<(c: CaptureInvalidationsCall) => void> = [];

  const runInvalidateQueries = queryClient.invalidateQueries.bind(queryClient);

  const mock = vi
    .spyOn(queryClient, 'invalidateQueries')
    .mockImplementation(async (filters, options) => {
      const call: CaptureInvalidationsCall = {
        filters: filters ?? {},
        options,
      };
      calls.push(call);
      waitQueue.shift()?.(call);
      return runInvalidateQueries(filters, options);
    });

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    mock.mockRestore();
  };
  bindRestoreOnAbortSignal(abortSignal, restore);

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
    restore,
  };
}
