import type { HttpClient } from 'mobx-tanstack-query-api';
import { sleep } from 'yummies/async';
import { createMockHttpResponse } from '../mock-http-response.js';

/**
 * Success or error payload passed to HTTP mock helpers.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/vitest/mock-http-client-request.html)
 */
export type MockHttpClientOutput<TData = unknown, TError = unknown> =
  | { success: TData; status?: number; delay?: number }
  | { error: TError; status?: number; delay?: number };

/**
 * Builds an implementation for `vi.spyOn(httpClient, 'request').mockImplementation(...)`.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/vitest/low-level/create-mock-http-client-request-handler.html)
 */
export function createMockHttpClientRequestHandler<
  TData = unknown,
  TError = unknown,
>(
  httpClient: HttpClient,
  output: MockHttpClientOutput<TData, TError>,
): (fullParams: any) => Promise<any> {
  return async (fullParams: any) => {
    await sleep(output.delay ?? 0);

    const response = await createMockHttpResponse<TData, TError>({
      requestParams: fullParams,
      httpClient,
    });

    if ('success' in output) {
      response.setData(output.success, { status: output.status });
      return response;
    }

    response.setError(output.error, { status: output.status });
    throw response;
  };
}
