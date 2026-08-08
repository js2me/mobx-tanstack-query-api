import {
  type AnyEndpoint,
  type FullRequestParams,
  HttpClient,
  HttpResponse,
  type InferEndpointData,
  type InferEndpointInput,
  type ResponseFormat,
} from 'mobx-tanstack-query-api';

import { testingDefaults } from './testing-defaults.js';

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

/**
 * Params for {@link MockHttpResponse.fromEndpoint}: same as {@link MockHttpResponseParams}, but
 * `requestParams` and `httpClient` are derived from the **endpoint**; `data` / `error` / `status`
 * are typed from the endpoint’s `HttpResponse`.
 */
export type MockHttpResponseFromEndpointParams<TEndpoint extends AnyEndpoint> =
  Omit<
    MockHttpResponseParams<
      InferEndpointData<TEndpoint>['data'],
      InferEndpointData<TEndpoint>['error'],
      InferEndpointData<TEndpoint>['status']
    >,
    'httpClient' | 'requestParams'
  > & {
    /**
     * Endpoint input forwarded to `endpoint.configuration.params(input)` to resolve
     * `requestParams` (and therefore the response `url`).
     */
    input?: Partial<InferEndpointInput<TEndpoint>>;
  };

const mockParamsHasData = (
  params: MockHttpResponseParams<any, any, any>,
): boolean => 'data' in params && params.data !== undefined;

const mockParamsHasError = (
  params: MockHttpResponseParams<any, any, any>,
): boolean => 'error' in params && params.error !== undefined;

/**
 * Test-oriented subclass of runtime `HttpResponse`. Prefer {@link createMockHttpResponse} for an instance whose body is already resolved.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/low-level/mock-http-response.html)
 */
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
    if (mockParamsHasData(this.params)) {
      this.data = this.params.data as TData;
    }
    if (mockParamsHasError(this.params)) {
      this.error = this.params.error as TError;
    }
  }

  /**
   * Constructs a {@link MockHttpResponse} whose `requestParams` and `url` are resolved from a real
   * **endpoint** (`endpoint.configuration.params(input)` + `endpoint.httpClient`). Body resolution
   * matches the constructor: call {@link MockHttpResponse.resolveBody} to apply `data` / `error`.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/low-level/mock-http-response.html)
   */
  static fromEndpoint<TEndpoint extends AnyEndpoint>(
    endpoint: TEndpoint,
    params: MockHttpResponseFromEndpointParams<NoInfer<TEndpoint>> = {},
  ): MockHttpResponse<
    InferEndpointData<TEndpoint>['data'],
    InferEndpointData<TEndpoint>['error'],
    InferEndpointData<TEndpoint>['status']
  > {
    const { input, ...rest } = params;

    return new MockHttpResponse<
      InferEndpointData<TEndpoint>['data'],
      InferEndpointData<TEndpoint>['error'],
      InferEndpointData<TEndpoint>['status']
    >({
      ...rest,
      httpClient: endpoint.httpClient,
      requestParams: endpoint.configuration.params(input ?? {}),
    });
  }

  setData(data: TData, options?: MockHttpResponseSetOptions): void {
    this.data = data;
    this.error = null as any;
    this.syncStatusFields(
      options?.status ?? testingDefaults.successStatus,
      options?.statusText,
    );
  }

  setError(error: TError, options?: MockHttpResponseSetOptions): void {
    this.error = error;
    this.data = null as any;
    this.syncStatusFields(
      options?.status ?? testingDefaults.errorStatus,
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
      (mockParamsHasData(params)
        ? testingDefaults.successStatus
        : testingDefaults.errorStatus)
    );
  }
}

/**
 * Constructs {@link MockHttpResponse} and awaits {@link MockHttpResponse.resolveBody} so `data` / `error` match runtime behaviour.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/low-level/mock-http-response.html)
 */
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
