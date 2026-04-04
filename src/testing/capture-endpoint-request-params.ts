import type {
  AnyEndpoint,
  FullRequestParams,
  InferEndpointInput,
} from 'mobx-tanstack-query-api';
import { type MockInstance, vi } from 'vitest';
import { bindRestoreOnAbortSignal } from './utils/bind-restore-on-abort-signal.js';

/**
 * Handle returned by {@link captureEndpointRequestParams}.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/capture-endpoint-request-params.html)
 */
export type CaptureEndpointRequestParamsHandle<TEndpoint extends AnyEndpoint> =
  {
    /** Resolved full request params from `endpoint.configuration.params`. */
    calls: FullRequestParams[];
    /** Last entry in {@link calls}. */
    get last(): FullRequestParams | undefined;
    /** Resolves on the next `endpoint.request` with the same `FullRequestParams` recorded in `calls`. */
    waitNext(): Promise<FullRequestParams>;
    /**
     * Registers **`waitNext`**, calls **`run()`** (usually **`endpoint.request(...)`**), awaits the returned
     * promise, and resolves with **`params`** plus the settled **`result`**.
     */
    withNextRequest(run: () => ReturnType<TEndpoint['request']>): Promise<{
      params: FullRequestParams;
      result: Awaited<ReturnType<TEndpoint['request']>>;
    }>;
    spy: MockInstance<TEndpoint['request']>;
    restore: () => void;
  };

/**
 * Intercepts `endpoint.request` and records resolved `FullRequestParams`.
 * Does not touch `HttpClient`; pair with separate client mocks by registering them after `capture`.
 *
 * Pass **`abortSignal`** (e.g. Vitest test context **`signal`**) to call **`restore()`** automatically
 * when the signal aborts (test cancellation).
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/capture-endpoint-request-params.html)
 */
export function captureEndpointRequestParams<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  abortSignal?: AbortSignal,
): CaptureEndpointRequestParamsHandle<TEndpoint> {
  const calls: FullRequestParams[] = [];
  const waitQueue: Array<(p: FullRequestParams) => void> = [];
  const invokeRealRequest = endpoint.request.bind(endpoint);

  const spy = vi.spyOn(endpoint, 'request' as any);
  (spy as any).mockImplementation((...args: any[]) => {
    const input = args[0];
    const full = endpoint.configuration.params(
      (input ?? {}) as InferEndpointInput<TEndpoint>,
    );
    calls.push(full);
    waitQueue.shift()?.(full);
    return invokeRealRequest(...args);
  });

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    spy.mockRestore();
  };
  bindRestoreOnAbortSignal(abortSignal, restore);

  const waitNext = () =>
    new Promise<FullRequestParams>((resolve) => {
      waitQueue.push(resolve);
    });

  return {
    calls,
    get last() {
      return calls.at(-1);
    },
    waitNext,
    withNextRequest: async (run) => {
      const paramsPromise = waitNext();
      const responsePromise = run();
      const params = await paramsPromise;
      const result = await responsePromise;
      return { params, result };
    },
    spy: spy as MockInstance<TEndpoint['request']>,
    restore,
  };
}
