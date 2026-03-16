/** biome-ignore-all lint/style/useShorthandFunctionType: this is special trick to add typings for callable class instance */
import type {
  DefaultError,
  InvalidateOptions,
  InvalidateQueryFilters,
  QueryFunctionContext,
  QueryKey,
} from '@tanstack/query-core';
import type { HttpStatusCode } from 'http-status-code-types';
import type { IQueryClientCore } from 'mobx-tanstack-query';
import { callFunction } from 'yummies/common';
import type { AnyObject, Defined, IsPartial, Maybe } from 'yummies/types';
import type {
  EndpointConfiguration,
  EndpointMutationPresets,
} from './endpoint.types.js';
import { EndpointInfiniteQuery } from './endpoint-infinite-query.js';
import type {
  EndpointInfiniteQueryFlattenOptions,
  EndpointInfiniteQueryOptions,
} from './endpoint-infinite-query.types.js';
import { EndpointMutation } from './endpoint-mutation.js';
import type { EndpointMutationOptions } from './endpoint-mutation.types.js';
import { EndpointQuery } from './endpoint-query.js';
import type {
  EndpointQueryFlattenOptions,
  EndpointQueryMeta,
  EndpointQueryOptions,
  EndpointQueryUniqKey,
} from './endpoint-query.types.js';
import type { EndpointQueryClient } from './endpoint-query-client.js';
import type { HttpClient } from './http-client.js';
import { type AnyResponse, isHttpResponse } from './http-response.js';

function isContractOptionEnabled(
  option: boolean | { params?: boolean; data?: boolean } | undefined,
  key: 'params' | 'data',
): boolean {
  return (
    option === true ||
    (typeof option === 'object' && option !== null && option[key] === true)
  );
}

export interface Endpoint<
  TResponse extends AnyResponse,
  TParams extends AnyObject,
  TMetaData extends AnyObject = AnyObject,
> {
  (
    ...args: IsPartial<TParams> extends true
      ? [params?: Maybe<TParams>]
      : [params: TParams]
  ): ReturnType<Endpoint<TResponse, TParams, TMetaData>['request']>;
}

/**
 * This class is a wrapper for your http request.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/)
 */
export class Endpoint<
  TResponse extends AnyResponse,
  TParams extends AnyObject,
  TMetaData extends AnyObject = AnyObject,
> {
  /**
   * Unique runtime identifier of the endpoint instance.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#endpointid)
   */
  endpointId: string;

  /**
   * Mutable presets used by helper factory methods like `toMutation()`.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#presets)
   */
  presets: {
    mutations: EndpointMutationPresets;
  } = {
    mutations: {},
  };

  /**
   * Type-only helper that exposes endpoint params shape.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#__params)
   */
  __params!: TParams;

  /**
   * Type-only helper that exposes endpoint response shape.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#__response)
   */
  __response!: TResponse;

  /**
   * Custom metadata attached to the endpoint configuration.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#meta)
   */
  meta!: TMetaData;

  /**
   * Endpoint configuration generated from the contract/codegen layer.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#configuration)
   */
  configuration: EndpointConfiguration<NoInfer<TParams>, TMetaData>;

  /**
   * Query client used by query and mutation helpers.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#queryclient)
   */
  queryClient: EndpointQueryClient;

  /**
   * HTTP client used to build URLs and execute requests.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#httpclient)
   */
  httpClient: HttpClient;

  protected validateParams: boolean = false;
  protected validateData: boolean = false;
  protected throwParams: boolean = false;
  protected throwData: boolean = false;

  /**
   * Creates a callable `Endpoint` instance.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#constructor)
   */
  constructor(
    configuration: EndpointConfiguration<NoInfer<TParams>, TMetaData>,
    queryClient: EndpointQueryClient,
    httpClient: HttpClient,
  ) {
    this.configuration = configuration;
    this.queryClient = queryClient;
    this.httpClient = httpClient;
    this.endpointId = globalThis.crypto.randomUUID();
    this.meta = configuration.meta ?? ({} as TMetaData);
    const vc = configuration.validateContract;
    this.validateParams = isContractOptionEnabled(vc, 'params');
    this.validateData = isContractOptionEnabled(vc, 'data');
    const tc = configuration.throwContracts;
    this.throwParams = isContractOptionEnabled(tc, 'params');
    this.throwData = isContractOptionEnabled(tc, 'data');
    // Сохраняем оригинальный инстанс
    const instance = this;

    // Создаем функцию-обертку
    const callable = function (
      this: any,
      ...args: IsPartial<TParams> extends true
        ? [params?: Maybe<TParams>]
        : [params: TParams]
    ) {
      return instance.request.apply(instance, args);
    } as unknown as Endpoint<TResponse, TParams, TMetaData>;

    // Копируем прототип
    Object.setPrototypeOf(callable, new.target.prototype);

    // Копируем методы из оригинального инстанса
    Object.getOwnPropertyNames(instance)
      .concat(Object.getOwnPropertyNames(new.target.prototype))
      .forEach((key) => {
        if (key === 'constructor') return;
        const desc =
          Object.getOwnPropertyDescriptor(instance, key) ||
          Object.getOwnPropertyDescriptor(new.target.prototype, key);
        if (desc) Object.defineProperty(callable, key, desc);
      });

    // biome-ignore lint/correctness/noConstructorReturn: this is special trick to add typings for callable class instance
    return callable;
  }

  /**
   * Returns a fully resolved request URL for the provided params.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#getfullurl)
   */
  getFullUrl(
    ...args: IsPartial<TParams> extends true
      ? [params?: Maybe<TParams>]
      : [params: TParams]
  ): string {
    const params = this.configuration.params(args[0] ?? ({} as TParams));
    return this.httpClient.buildUrl(params);
  }

  /**
   * Returns the resolved request path without the base URL.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#getpath)
   */
  getPath(
    ...args: IsPartial<TParams> extends true
      ? [params?: Maybe<TParams>]
      : [params: TParams]
  ): string {
    const params = this.configuration.params(args[0] ?? ({} as TParams));
    return params.path;
  }

  /**
   * Extracts endpoint params from TanStack Query function context.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#getparamsfromcontext)
   */
  getParamsFromContext<
    TQueryKey extends QueryKey = QueryKey,
    TPageParam = never,
  >(
    ctx: Omit<QueryFunctionContext<TQueryKey, TPageParam>, 'client'> & {
      client: IQueryClientCore;
    },
  ): TParams {
    return (ctx.queryKey.at(-2) || {}) as TParams;
  }

  /**
   * Tags declared for the endpoint.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#tags)
   */
  get tags() {
    return this.configuration.tags;
  }

  /**
   * Path segments declared for the endpoint.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#path)
   */
  get path() {
    return this.configuration.path;
  }

  /**
   * Slash-joined path declaration for the endpoint.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#pathdeclaration)
   */
  get pathDeclaration() {
    return this.path.join('/');
  }

  /**
   * Operation identifier from the endpoint configuration.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#operationid)
   */
  get operationId() {
    return this.configuration.operationId;
  }

  /**
   * Optional endpoint group.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#group)
   */
  get group() {
    return this.configuration.group;
  }

  /**
   * Optional endpoint namespace.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#namespace)
   */
  get namespace() {
    return this.configuration.namespace;
  }

  /**
   * Narrows unknown values to endpoint HTTP responses.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#checkresponse)
   */
  checkResponse<TStatus extends HttpStatusCode>(
    response: unknown,
    status: TStatus,
  ): response is Extract<TResponse, { status: TStatus }>;
  checkResponse(response: unknown): response is TResponse;
  checkResponse(response: unknown, status?: HttpStatusCode) {
    return isHttpResponse(response, status);
  }

  protected async validateContract(
    kind: 'params' | 'data',
    contract: { safeParseAsync: (input: unknown) => Promise<any> } | undefined,
    payload: unknown,
    options?: { throw?: boolean },
  ): Promise<unknown> {
    if (!contract?.safeParseAsync) return;

    const label = kind === 'params' ? 'Params' : 'Data';
    const shouldThrow = options?.throw === true;

    try {
      const result = await contract.safeParseAsync(payload);
      if (!result?.success) {
        if (shouldThrow) {
          throw result?.error;
        } else {
          console.warn(
            `[mobx-tanstack-query-api] ${label} contract validation failed for "${this.operationId}"`,
            result?.error,
            payload,
          );
          return;
        }
      }
      return result.data;
    } catch (error) {
      if (shouldThrow) {
        throw error;
      } else {
        console.warn(
          `[mobx-tanstack-query-api] ${label} contract validation threw for "${this.operationId}"`,
          error,
          payload,
        );
        return;
      }
    }
  }

  /**
   * Performs the HTTP request and optionally validates contracts.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#request)
   */
  async request(
    ...args: IsPartial<TParams> extends true
      ? [params?: Maybe<TParams>]
      : [params: TParams]
  ) {
    const rawParams = (args[0] ?? {}) as TParams;

    const contract = this.configuration.contract;

    const params =
      this.validateParams && contract?.params
        ? (((await this.validateContract(
            'params',
            contract?.params as any,
            rawParams,
            { throw: this.throwParams },
          )) ?? rawParams) as TParams)
        : rawParams;

    const response = await this.httpClient.request<TResponse>(
      this.configuration.params(params),
      this,
    );

    if (
      this.validateData &&
      contract?.data?.safeParseAsync &&
      this.checkResponse(response) &&
      response.ok
    ) {
      const parsedData = await this.validateContract(
        'data',
        contract?.data as any,
        response.data,
        { throw: this.throwData },
      );
      if (parsedData !== undefined) {
        response.data = parsedData as TResponse['data'];
      }
    }

    return response;
  }

  /**
   * Builds query metadata payload enriched with endpoint fields.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#toquerymeta)
   */
  toQueryMeta = (meta?: AnyObject) =>
    ({
      ...meta,
      tags: this.tags,
      operationId: this.operationId,
      path: this.path,
      pathDeclaration: this.pathDeclaration,
      endpointId: this.endpointId,
      endpointQuery: true,
    }) satisfies EndpointQueryMeta;

  /**
   * Builds a stable TanStack Query key for a regular query.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#toquerykey)
   */
  toQueryKey(params?: Maybe<TParams>, uniqKey?: EndpointQueryUniqKey): any {
    return [
      ...this.configuration.path,
      this.configuration.operationId,
      params ?? {},
      callFunction(uniqKey),
    ];
  }

  /**
   * Builds a stable TanStack Query key for an infinite query.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#toinfinitequerykey)
   */
  toInfiniteQueryKey(
    params?: Maybe<TParams>,
    uniqKey?: EndpointQueryUniqKey,
  ): any {
    return [
      { infiniteQuery: true },
      ...this.configuration.path,
      this.configuration.operationId,
      params ?? {},
      callFunction(uniqKey),
    ];
  }

  /**
   * Invalidates the exact query produced by this endpoint.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#invalidatequery)
   */
  invalidateQuery(
    ...args: IsPartial<TParams> extends true
      ? [
          params?: Maybe<TParams>,
          filters?: InvalidateQueryFilters & { uniqKey?: EndpointQueryUniqKey },
          options?: InvalidateOptions,
        ]
      : [
          params: TParams,
          filters?: InvalidateQueryFilters & { uniqKey?: EndpointQueryUniqKey },
          options?: InvalidateOptions,
        ]
  ) {
    this.queryClient.invalidateQueries(
      {
        queryKey: this.toQueryKey(args[0], args[1]?.uniqKey),
        exact: true,
        ...(args[1] as any),
      },
      args[2],
    );
  }

  /**
   * Creates an `EndpointMutation` bound to this endpoint.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#tomutation)
   */
  toMutation<
    TData = TResponse['data'],
    TMutationMeta extends AnyObject | void = void,
    TContext = unknown,
  >(
    options: EndpointMutationOptions<
      this,
      TData,
      TParams,
      TMutationMeta,
      TContext
    >,
  ) {
    return new EndpointMutation<this, TData, TParams, TMutationMeta, TContext>(
      this,
      this.queryClient,
      {
        ...options,
        invalidateEndpoints:
          options.invalidateEndpoints ??
          this.presets.mutations?.invalidateQueries,
      },
    );
  }

  /**
   * Creates an `EndpointQuery` bound to this endpoint.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#toquery)
   */
  toQuery<
    TQueryFnData = TResponse['data'],
    TError = DefaultError | Defined<TResponse['error']>,
    TData = TQueryFnData,
    TQueryData = TQueryFnData,
  >(
    options:
      | EndpointQueryOptions<this, TQueryFnData, TError, TData, TQueryData>
      | (() => EndpointQueryFlattenOptions<
          this,
          TQueryFnData,
          TError,
          TData,
          TQueryData
        >),
  ) {
    return new EndpointQuery<this, TQueryFnData, TError, TData, TQueryData>(
      this,
      this.queryClient,
      options,
    );
  }

  /**
   * Creates an `EndpointInfiniteQuery` bound to this endpoint.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoints/#toinfinitequery)
   */
  toInfiniteQuery<
    TQueryFnData = TResponse['data'],
    TError = DefaultError | Defined<TResponse['error']>,
    TPageParam = unknown,
    TData = import('@tanstack/query-core').InfiniteData<
      TQueryFnData,
      TPageParam
    >,
  >(
    options:
      | EndpointInfiniteQueryOptions<
          this,
          TQueryFnData,
          TError,
          TPageParam,
          TData
        >
      | (() => EndpointInfiniteQueryFlattenOptions<
          this,
          TQueryFnData,
          TError,
          TPageParam,
          TData
        >),
  ) {
    return new EndpointInfiniteQuery<
      this,
      TQueryFnData,
      TError,
      TPageParam,
      TData
    >(this, this.queryClient, options);
  }
}
