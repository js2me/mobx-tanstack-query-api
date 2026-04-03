import { sleep } from 'yummies/async';
import type { HttpClient } from '../../runtime/http-client.js';
import { createMockHttpResponse } from '../mock-http-response.js';

export type MockHttpClientOutput<TData = unknown, TError = unknown> =
  | { success: TData; status?: number; delay?: number }
  | { error: TError; status?: number; delay?: number };

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
