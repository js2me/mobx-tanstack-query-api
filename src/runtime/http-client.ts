import { action, makeObservable, observable } from 'mobx';
import { type BooleanOptional, type IStringifyOptions, stringify } from 'qs';
import type { AnyObject, Defined, Maybe } from 'yummies/types';
import type { AnyEndpoint } from './endpoint.types.js';
import {
  type AnyHttpResponse,
  type AnyResponse,
  HttpResponse,
  type ResponseFormat,
} from './http-response.js';

export type QueryParamsType = Record<string | number, any>;

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

  protected async createResponse(
    responseFormat: FullRequestParams['format'] = 'json',
    raw: Response,
    url: string,
    params: RequestInit,
  ): Promise<AnyHttpResponse> {
    const response = new HttpResponse<any, any>(raw, { url, params });

    if (response.isEmpty()) {
      return response;
    }

    await response.resolveBody(responseFormat);

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

    let response: Response;

    try {
      response = await this.fetch(fetchUrl, fetchParams);
    } catch (error) {
      if (error instanceof Response) {
        response = error;
      } else {
        throw error;
      }
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
