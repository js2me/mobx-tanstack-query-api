import { type MockInstance, vi } from 'vitest';
import type { AnyEndpoint } from '../runtime/endpoint.types.js';

export type StubEndpointThrowOptions = {
  /** When true, every call throws; otherwise only once (`mockImplementationOnce`). */
  persistent?: boolean;
};

/**
 * Makes `endpoint.request` reject with an arbitrary error (not necessarily `HttpResponse`).
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
  return spy as MockInstance<TEndpoint['request']>;
}
