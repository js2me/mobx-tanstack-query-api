import type {
  AnyEndpoint,
  FullRequestParams,
  InferEndpointInput,
} from 'mobx-tanstack-query-api';
import { type MockInstance, vi } from 'vitest';

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
    spy: MockInstance<TEndpoint['request']>;
    restore: () => void;
  };

/**
 * Intercepts `endpoint.request` and records resolved `FullRequestParams`.
 * Does not touch `HttpClient`; pair with separate client mocks by registering them after `capture`.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/capture-endpoint-request-params.html)
 */
export function captureEndpointRequestParams<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
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

  return {
    calls,
    get last() {
      return calls.at(-1);
    },
    waitNext: () =>
      new Promise<FullRequestParams>((resolve) => {
        waitQueue.push(resolve);
      }),
    spy: spy as MockInstance<TEndpoint['request']>,
    restore: () => spy.mockRestore(),
  };
}
