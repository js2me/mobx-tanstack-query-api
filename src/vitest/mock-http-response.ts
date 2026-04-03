import type { FullRequestParams } from '../runtime/http-client.js';
import { HttpClient } from '../runtime/http-client.js';
import { HttpResponse, type ResponseFormat } from '../runtime/http-response.js';

export type MockHttpResponseParams<
  TData = any,
  TError = null,
  TStatus extends number = number,
> = {
  data?: TData;
  error?: TError;
  status?: TStatus;
  statusText?: string;
  url?: string;
  httpClient?: HttpClient;
  requestParams: FullRequestParams;
  body?: BodyInit | null;
  init?: ResponseInit;
};

export type MockHttpResponseSetOptions = {
  status?: number;
  statusText?: string;
};

const DEFAULT_SUCCESS_STATUS = 200;
const DEFAULT_ERROR_STATUS = 500;

const mockParamsHasTruthyData = (
  params: MockHttpResponseParams<any, any, any>,
): boolean => 'data' in params && !!params.data;

const mockParamsHasTruthyError = (
  params: MockHttpResponseParams<any, any, any>,
): boolean => 'error' in params && !!params.error;

export class MockHttpResponse<
  TData = any,
  TError = null,
  TStatus extends number = number,
> extends HttpResponse<TData, TError, TStatus> {
  constructor(private params: MockHttpResponseParams<TData, TError, TStatus>) {
    const httpClient = params.httpClient ?? new HttpClient();

    const resolvedStatus = MockHttpResponse.resolveStatus(params);

    const response = new Response(params.body, {
      ...params.init,
      status: resolvedStatus,
      ...(params.statusText !== undefined
        ? { statusText: params.statusText }
        : {}),
    });

    super(response, {
      url: params.url ?? httpClient.buildUrl(params.requestParams),
      params: params.requestParams as RequestInit,
    });
  }

  async resolveBody(_responseFormat: ResponseFormat): Promise<void> {
    if (mockParamsHasTruthyData(this.params)) {
      this.data = this.params.data as TData;
    }
    if (mockParamsHasTruthyError(this.params)) {
      this.error = this.params.error as TError;
    }
  }

  setData(data: TData, options?: MockHttpResponseSetOptions): void {
    this.data = data;
    this.error = null as any;
    this.syncStatusFields(
      options?.status ?? DEFAULT_SUCCESS_STATUS,
      options?.statusText,
    );
  }

  setError(error: TError, options?: MockHttpResponseSetOptions): void {
    this.error = error;
    this.data = null as any;
    this.syncStatusFields(
      options?.status ?? DEFAULT_ERROR_STATUS,
      options?.statusText,
    );
  }

  private syncStatusFields(status: number, statusText?: string): void {
    this.status = status as TStatus;
    this.ok = status >= 200 && status < 300;
    if (statusText !== undefined) {
      this.statusText = statusText;
    }
  }

  private static resolveStatus(
    params: MockHttpResponseParams<any, any, any>,
  ): number {
    return (
      params.status ??
      (mockParamsHasTruthyData(params)
        ? DEFAULT_SUCCESS_STATUS
        : DEFAULT_ERROR_STATUS)
    );
  }
}

export async function createMockHttpResponse<
  TData = any,
  TError = null,
  TStatus extends number = number,
>(
  params: MockHttpResponseParams<TData, TError, TStatus>,
): Promise<MockHttpResponse<TData, TError, TStatus>> {
  const response = new MockHttpResponse(params);

  await response.resolveBody('json');

  return response;
}
