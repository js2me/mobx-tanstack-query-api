import { action, makeObservable, observable } from 'mobx';

export type QueryParamsType = Record<string | number, any>;
export type ResponseFormat = keyof Omit<Body, 'body' | 'bodyUsed'>;

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

export type RequestParams = Omit<
  FullRequestParams,
  'body' | 'method' | 'query' | 'path' | 'serviceName'
>;

export interface HttpClientConfig<TMeta = unknown> {
  baseUrl?: string;
  meta?: TMeta;
  baseApiParams?: Omit<RequestParams, 'baseUrl' | 'cancelToken' | 'signal'>;
  contentFormatters?: Record<string, (input: any) => any>;
  toQueryString?: (query?: QueryParamsType) => string;
  buildUrl?: (
    fullParams: FullRequestParams,
    formattedParts: { baseUrl: string; path: string; query: string },
  ) => string;
  interceptor?: (
    requestParams: RequestParams,
    metadata: TMeta | null,
  ) => Promise<RequestParams | void> | RequestParams | void;
  fetch?: typeof fetch;
}

export interface HttpResponse<D, E = unknown> extends Response {
  data: D;
  error: E;
}

export type AnyHttpResponse = HttpResponse<any, any>;

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
  return isHttpResponse(response) && !response.ok;
};

export class HttpClient<TMeta = unknown> {
  public baseUrl: string = '';
  public meta: TMeta | null = null;
  private interceptor?: HttpClientConfig<TMeta>['interceptor'];
  private fetch: typeof fetch;
  private customBuildUrl: HttpClientConfig<TMeta>['buildUrl'];
  private customToQueryString: HttpClientConfig<TMeta>['toQueryString'];

  private baseApiParams: RequestParams = {
    credentials: 'same-origin',
    headers: {},
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
  };

  badResponse: unknown = null;

  constructor(config?: HttpClientConfig<TMeta>) {
    this.baseUrl = config?.baseUrl ?? '';
    this.meta = config?.meta ?? null;
    this.interceptor = config?.interceptor;
    this.fetch = config?.fetch ?? fetch;
    this.customBuildUrl = config?.buildUrl;
    this.customToQueryString = config?.toQueryString;

    Object.assign(this.contentFormatters, config?.contentFormatters ?? {});

    observable.ref(this, 'badResponse');
    observable.ref(this, 'meta');
    action(this, 'setMeta');
    action(this, 'setBadResponse');
    makeObservable(this);
  }

  public setMeta = (data: TMeta | null) => {
    this.meta = data;
  };

  public setBadResponse = (response: unknown) => {
    this.badResponse = response;
  };

  protected encodeQueryParam(key: string, value: any) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(
      typeof value === 'number' ? value : `${value}`,
    )}`;
  }

  protected addQueryParam(query: QueryParamsType, key: string) {
    return this.encodeQueryParam(key, query[key]);
  }

  protected addArrayQueryParam(query: QueryParamsType, key: string) {
    const value = query[key];
    return value.map((v: any) => this.encodeQueryParam(key, v)).join('&');
  }

  protected toQueryString(rawQuery?: QueryParamsType): string {
    if (this.customToQueryString) {
      return this.customToQueryString(rawQuery);
    }

    const query = rawQuery || {};
    const keys = Object.keys(query).filter(
      (key) => 'undefined' !== typeof query[key],
    );
    return keys
      .map((key) =>
        Array.isArray(query[key])
          ? this.addArrayQueryParam(query, key)
          : this.addQueryParam(query, key),
      )
      .join('&');
  }

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

  private async formatResponse(
    responseFormat: FullRequestParams['format'],
    raw: Response,
  ): Promise<AnyHttpResponse> {
    const response = raw as AnyHttpResponse;
    response.data = null;
    response.error = null;

    if (responseFormat) {
      try {
        const formatted = await response[responseFormat]();
        if (response.ok) {
          response.data = formatted;
        } else {
          response.error = formatted;
        }
      } catch (error) {
        if (response.ok) {
          response.error = error;
        } else {
          response.error = null;
        }
      }
    }

    if (!response.ok) {
      this.setBadResponse(response);
      throw response;
    }

    return response;
  }

  public buildUrl = (params: FullRequestParams) => {
    const baseUrl = params.baseUrl ?? this.baseUrl ?? '';

    const path = params.path;

    const queryString = params.query && this.toQueryString(params.query);

    const query = queryString ? `?${queryString}` : '';

    if (this.customBuildUrl) {
      return this.customBuildUrl(params, { baseUrl, path, query });
    }

    const url = baseUrl + path + query;

    return url;
  };

  public request = async <T = any, E = any>(
    fullParams: FullRequestParams,
  ): Promise<HttpResponse<T, E>> => {
    this.setBadResponse(null);

    const {
      body,
      contentType = 'application/json',
      format = 'json',
      ...params
    } = fullParams;

    let requestParams = this.mergeRequestParams(params);

    if (this.interceptor) {
      requestParams =
        (await this.interceptor(requestParams, this.meta)) ?? requestParams;
    }

    const payloadFormatter = this.contentFormatters[contentType];
    const responseFormat = format || requestParams.format;

    const url = this.buildUrl(fullParams);

    const responseFormatter = this.formatResponse.bind(this, responseFormat);

    let headers: Headers;

    if (requestParams.headers instanceof Headers) {
      headers = requestParams.headers;
    } else if (Array.isArray(requestParams.headers)) {
      headers = new Headers(requestParams.headers);
    } else {
      headers = new Headers(requestParams.headers);
    }

    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', contentType);
    }

    return this.fetch(url, {
      ...requestParams,
      headers,
      body: body == null ? null : payloadFormatter(body),
    })
      .then(responseFormatter)
      .catch(responseFormatter);
  };
}
