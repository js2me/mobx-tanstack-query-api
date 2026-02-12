import type {
  HttpStatusCode,
  HttpSuccessStatusCode,
} from 'http-status-code-types';
import type { ValueOf } from 'yummies/types';

export const emptyStatusCodesSet = new Set([204, 205, 304]);

export interface RequestInfo {
  url: string;
  params: globalThis.RequestInit;
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

export type ResponseFormat = ValueOf<{
  [K in keyof Body]: Body[K] extends Function ? K : never;
}>;

export class HttpResponse<
  TData,
  TError = null,
  TStatus extends number = number,
> {
  headers;
  ok;
  redirected;
  statusText;
  type;
  url;
  body;

  data: TData;
  error: TError;
  status: TStatus;

  constructor(
    public originalResponse: Response,
    public request: RequestInfo,
  ) {
    this.headers = originalResponse.headers;
    this.ok = originalResponse.ok;
    this.body = originalResponse.body;
    this.redirected = originalResponse.redirected;
    this.status = originalResponse.status as TStatus;
    this.statusText = originalResponse.statusText;
    this.type = originalResponse.type;
    this.url = originalResponse.url;
    this.data = null as any;
    this.error = null as any;
  }

  clone(): HttpResponse<TData, TError, TStatus> {
    return new HttpResponse(this.originalResponse.clone(), this.request);
  }

  isEmpty() {
    if (emptyStatusCodesSet.has(this.status)) {
      return true;
    }

    const contentLength = this.headers.get('content-length');

    if (contentLength !== null && contentLength === '0') {
      return true;
    }

    if (this.body === null) {
      return true;
    }

    return false;
  }

  async resolveBody(responseFormat: ResponseFormat) {
    try {
      const formatted = await this.originalResponse[responseFormat]();
      if (this.ok) {
        this.data = formatted;
      } else {
        this.error = formatted;
      }
    } catch (error) {
      this.error = error as TError;
    }
  }
}

export const isHttpResponse = (
  response: unknown,
  status?: number,
): response is AnyHttpResponse =>
  typeof response === 'object' &&
  response instanceof HttpResponse &&
  'data' in response &&
  (!status || response.status === status);

export const isHttpBadResponse = (
  response: unknown,
): response is HttpResponse<null, any> => {
  return isHttpResponse(response) && (!response.ok || !!response.error);
};
