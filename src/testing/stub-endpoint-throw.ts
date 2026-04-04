import type { AnyEndpoint } from 'mobx-tanstack-query-api';
import { type MockInstance, vi } from 'vitest';
import { bindRestoreOnAbortSignal } from './utils/bind-restore-on-abort-signal.js';

/**
 * Options for {@link stubEndpointThrow}.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/stub-endpoint-throw.html)
 */
export type StubEndpointThrowOptions = {
  /** When true, every call throws; otherwise only once (`mockImplementationOnce`). */
  persistent?: boolean;
  /** Vitest test **`signal`**: **`spy.mockRestore()`** runs when the signal aborts. */
  abortSignal?: AbortSignal;
};

/**
 * Makes `endpoint.request` reject with an arbitrary error (not necessarily `HttpResponse`).
 *
 * Pass **`abortSignal`** in **`options`** (e.g. Vitest test **`signal`**) to call **`spy.mockRestore()`**
 * when the signal aborts. Manual **`spy.mockRestore()`** remains safe (idempotent with abort cleanup).
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/stub-endpoint-throw.html)
 */
export function stubEndpointThrow<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  error: unknown | (() => unknown) | (() => Promise<unknown>),
  options?: StubEndpointThrowOptions,
): MockInstance<TEndpoint['request']> {
  const spy = vi.spyOn(endpoint, 'request' as any);
  const impl = async () => {
    const e =
      typeof error === 'function'
        ? await (error as () => unknown | Promise<unknown>)()
        : error;
    throw e;
  };
  if (options?.persistent) {
    (spy as any).mockImplementation(impl);
  } else {
    (spy as any).mockImplementationOnce(impl);
  }

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    spy.mockRestore();
  };
  bindRestoreOnAbortSignal(options?.abortSignal, restore);

  return spy as MockInstance<TEndpoint['request']>;
}
