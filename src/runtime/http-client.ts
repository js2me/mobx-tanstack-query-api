import type {
  HttpStatusCode,
  HttpSuccessStatusCode,
} from 'http-status-code-types';
import { action, makeObservable, observable } from 'mobx';
import { type BooleanOptional, type IStringifyOptions, stringify } from 'qs';
import type { AnyObject, Defined, Maybe, ValueOf } from 'yummies/types';
import type { AnyEndpoint } from './endpoint.types.js';

export type QueryParamsType = Record<string | number, any>;
export type ResponseFormat = ValueOf<{
  [K in keyof Body]: Body[K] extends Function ? K : never;
}>;

export interface FullRequestParams extends Omit<RequestInit, 'body'> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  contentType?: string;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseFormat;
  /** request body */
  body?: unknown;
  /** base url */
  baseUrl?: string;
  /** meta data */
  meta?: Record<string, any>;
}

export const ContentType = {
  Json: 'application/json',
  FormData: 'multipart/form-data',
  UrlEncoded: 'application/x-www-form-urlencoded',
  Text: 'text/plain',
  Binary: 'application/octet-stream',
} as const;

export type RequestParams = Omit<
  FullRequestParams,
  'body' | 'method' | 'query' | 'path' | 'serviceName'
>;

export interface HttpClientConfig<TMeta = unknown> {
  baseUrl?: string;
  meta?: TMeta;
  fetch?: typeof globalThis.fetch;
  baseApiParams?: Omit<RequestParams, 'baseUrl' | 'cancelToken' | 'signal'>;
  contentFormatters?: Record<string, (input: any) => any>;
  queryStringifyOptions?: IStringifyOptions<BooleanOptional>;
  toQueryString?: (query?: AnyObject) => string;
  buildUrl?: (
    fullParams: FullRequestParams,
    formattedParts: { baseUrl: string; path: string; query: string },
    metadata: TMeta | null,
  ) => string;
  interceptor?: (
    requestParams: RequestParams,
    metadata: TMeta | null,
    endpoint?: Maybe<AnyEndpoint>,
  ) => Promise<RequestParams | void> | RequestParams | void;
}

export interface HttpResponse<TData, TError = null, TStatus = number>
  extends Omit<Response, 'status'> {
  data: TData;
  error: TError;
  status: TStatus;
  request: {
    url: string;
    params: globalThis.RequestInit;
  };
}

type ResponsesByStatusMap = {
  [K in HttpStatusCode]?: any;
};

export type HttpMultistatusResponse<
  TResponsesByStatusMap extends ResponsesByStatusMap,
  TDefaultOkResponse,
  TDefaultBadResponse = unknown,
> = Omit<Response, 'status'> &
  (
    | ValueOf<{
        [K in keyof TResponsesByStatusMap]: {
          status: K;
          data: K extends HttpSuccessStatusCode
            ? TResponsesByStatusMap[K]
            : TDefaultOkResponse;
          error: K extends HttpSuccessStatusCode
            ? TDefaultBadResponse
            : TResponsesByStatusMap[K];
          request: {
            url: string;
            params: globalThis.RequestInit;
          };
        };
      }>
    | {
        status: Exclude<HttpStatusCode, keyof TResponsesByStatusMap>;
        data: TDefaultOkResponse;
        error: TDefaultBadResponse;
        request: {
          url: string;
          params: globalThis.RequestInit;
        };
      }
  );

export type GetHttpResponse<T> = T extends (...args: any[]) => infer R
  ? R extends Promise<HttpResponse<any, any>>
    ? Awaited<R>
    : R extends Promise<HttpMultistatusResponse<any, any, any>>
      ? Awaited<R>
      : HttpResponse<any, any>
  : HttpResponse<any, any>;

export type HttpBadResponse<T = any> = HttpResponse<null, T>;

export type AnyHttpResponse = HttpResponse<any, any>;

export type AnyHttpMultistatusResponse = HttpMultistatusResponse<
  ResponsesByStatusMap,
  any,
  any
>;

export type AnyResponse = AnyHttpResponse | AnyHttpMultistatusResponse;

export const isHttpResponse = (
  response: unknown,
  status?: number,
): response is AnyHttpResponse =>
  !!response &&
  typeof response === 'object' &&
  response instanceof Response &&
  'data' in response &&
  (!status || response.status === status);

export const isHttpBadResponse = (
  response: unknown,
): response is HttpResponse<null, any> => {
  return isHttpResponse(response) && (!response.ok || !!response.error);
};

export const emptyStatusCodesSet = new Set([204, 205, 304]);

export class HttpClient<TMeta = unknown> {
  private config: HttpClientConfig<TMeta>;
  private fetch: Required<HttpClientConfig<TMeta>>['fetch'];

  public meta: TMeta | null;
  public baseApiParams: RequestParams;

  badResponse: unknown;

  protected toQueryString: Defined<HttpClientConfig<TMeta>['toQueryString']>;

  constructor(config?: HttpClientConfig<TMeta>) {
    this.config = config ?? {};
    this.badResponse = null;
    this.meta = config?.meta ?? null;
    this.fetch =
      config?.fetch ??
      ((...fetchParams: Parameters<typeof globalThis.fetch>) =>
        globalThis.fetch(...fetchParams));
    this.toQueryString =
      config?.toQueryString ??
      ((query) => stringify(query, config?.queryStringifyOptions));

    this.baseApiParams = {
      credentials: 'same-origin',
      headers: {},
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
    };

    this.updateConfig(this.config);

    observable.ref(this, 'badResponse');
    observable.ref(this, 'meta');

    action(this, 'setMeta');
    action(this, 'setBadResponse');

    makeObservable(this);
  }

  get baseUrl() {
    return this.config.baseUrl ?? '';
  }

  public updateConfig(update: Partial<HttpClientConfig<TMeta>>) {
    Object.assign(this.config, update);

    if (update.baseApiParams) {
      Object.assign(this.baseApiParams, update.baseApiParams);
    }

    if (update.contentFormatters) {
      Object.assign(this.contentFormatters, update.contentFormatters);
    }

    if (update.fetch) {
      this.fetch = update.fetch;
    }
  }

  public setMeta = (data: TMeta | null) => {
    this.meta = data;
  };

  public setBadResponse = (response: unknown) => {
    this.badResponse = response;
  };

  private contentFormatters: Record<string, (input: any) => any> = {
    'application/json': (input: any) =>
      input !== null && (typeof input === 'object' || typeof input === 'string')
        ? JSON.stringify(input)
        : input,
    'text/plain': (input: any) =>
      input !== null && typeof input !== 'string'
        ? JSON.stringify(input)
        : input,
    'multipart/form-data': (input: any) =>
      Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];

        if (property instanceof Blob) {
          formData.append(key, property);
        } else if (typeof property === 'object' && property !== null) {
          formData.append(key, JSON.stringify(property));
        } else {
          formData.append(key, `${property}`);
        }

        return formData;
      }, new FormData()),
    'application/x-www-form-urlencoded': (input: any) =>
      this.toQueryString(input),
    'application/octet-stream': (input: any) => input,
  };

  protected mergeRequestParams(
    params1: RequestParams,
    params2?: RequestParams,
  ): RequestParams {
    return {
      ...this.baseApiParams,
      ...params1,
      ...params2,
      headers: {
        ...this.baseApiParams.headers,
        ...params1.headers,
        ...params2?.headers,
      },
    };
  }

  protected isEmptyResponseBody(response: Response): boolean {
    if (emptyStatusCodesSet.has(response.status)) {
      return true;
    }

    const contentLength = response.headers.get('content-length');

    if (contentLength !== null && contentLength === '0') {
      return true;
    }

    if (response.body === null) {
      return true;
    }

    return false;
  }

  /**
   * Some custom fetch implementations expose read-only accessors (e.g. `data`),
   * so plain assignment can throw in strict mode.
   */
  private setResponseField = <
    TKey extends keyof Pick<AnyHttpResponse, 'request' | 'data' | 'error'>,
  >(
    response: AnyHttpResponse,
    key: TKey,
    value: AnyHttpResponse[TKey],
  ) => {
    try {
      response[key] = value;
      return;
    } catch {
      // Fallback for getter-only inherited descriptors.
    }

    Object.defineProperty(response, key, {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  };

  protected async createResponse(
    responseFormat: FullRequestParams['format'] = 'json',
    raw: Response,
    url: string,
    params: RequestInit,
  ): Promise<AnyHttpResponse> {
    const response = raw as AnyHttpResponse;

    this.setResponseField(response, 'request', { url, params });
    this.setResponseField(response, 'data', null);
    this.setResponseField(response, 'error', null);

    if (this.isEmptyResponseBody(response)) {
      return response;
    }

    try {
      const formatted = await response[responseFormat]();
      if (response.ok) {
        this.setResponseField(response, 'data', formatted);
      } else {
        this.setResponseField(response, 'error', formatted);
      }
    } catch (error) {
      this.setResponseField(response, 'error', error);
    }

    if (!response.ok || response.error) {
      this.setBadResponse(response);
    }

    return response;
  }

  public buildUrl = (params: FullRequestParams) => {
    const baseUrl = params.baseUrl ?? this.baseUrl ?? '';

    const path = params.path;

    const queryString = params.query && this.toQueryString(params.query);

    const query = queryString ? `?${queryString}` : '';

    if (this.config.buildUrl) {
      return this.config.buildUrl(params, { baseUrl, path, query }, this.meta);
    }

    const url = baseUrl + path + query;

    return url;
  };

  public request<T, E>(
    fullParams: FullRequestParams,
    endpoint?: Maybe<AnyEndpoint>,
  ): Promise<HttpResponse<T, E>>;
  public request<THttpResponse extends AnyResponse>(
    fullParams: FullRequestParams,
    endpoint?: Maybe<AnyEndpoint>,
  ): Promise<THttpResponse>;

  public async request(
    fullParams: FullRequestParams,
    endpoint?: Maybe<AnyEndpoint>,
  ): Promise<any> {
    this.setBadResponse(null);

    const { body, contentType, format, ...params } = fullParams;

    let requestParams = this.mergeRequestParams(params);

    if (this.config.interceptor) {
      requestParams =
        (await this.config.interceptor(requestParams, this.meta, endpoint)) ??
        requestParams;
    }

    const responseFormat = format || requestParams.format;

    const url = this.buildUrl(fullParams);

    let headers: Headers;

    if (requestParams.headers instanceof Headers) {
      headers = requestParams.headers;
    } else if (Array.isArray(requestParams.headers)) {
      headers = new Headers(requestParams.headers);
    } else {
      headers = new Headers(requestParams.headers);
    }

    let bodyToSend: Maybe<BodyInit>;

    if (contentType) {
      if (
        contentType !== ContentType.FormData &&
        !headers.has('Content-Type')
      ) {
        headers.set('Content-Type', contentType);
      }

      const payloadFormatter = this.contentFormatters[contentType];

      if (body == null) {
        bodyToSend = null;
      } else if (payloadFormatter) {
        bodyToSend = payloadFormatter(body);
      } else {
        bodyToSend = body as any;
      }
    }

    const fetchUrl: string = url;
    const fetchParams: RequestInit = {
      ...requestParams,
      headers,
      body: bodyToSend,
    };

    let response: Response | undefined;

    try {
      response = await this.fetch(fetchUrl, fetchParams);
    } catch (error) {
      response = error as Response;
    }

    const httpResponse = await this.createResponse(
      responseFormat,
      response,
      fetchUrl,
      fetchParams,
    );

    if (!httpResponse.ok || httpResponse.error) {
      throw httpResponse;
    }

    return httpResponse;
  }
}
