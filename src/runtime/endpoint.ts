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
  endpointId: string;

  presets: {
    mutations: EndpointMutationPresets;
  } = {
    mutations: {},
  };

  __params!: TParams;
  __response!: TResponse;

  meta!: TMetaData;

  protected validateParams: boolean = false;
  protected validateData: boolean = false;
  protected throwParams: boolean = false;
  protected throwData: boolean = false;

  constructor(
    public configuration: EndpointConfiguration<NoInfer<TParams>, TMetaData>,
    public queryClient: EndpointQueryClient,
    public httpClient: HttpClient,
  ) {
    this.endpointId = globalThis.crypto.randomUUID();
    this.meta = configuration.meta ?? ({} as TMetaData);
    const vc = configuration.validateContracts;
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

  getFullUrl(
    ...args: IsPartial<TParams> extends true
      ? [params?: Maybe<TParams>]
      : [params: TParams]
  ): string {
    const params = this.configuration.params(args[0] ?? ({} as TParams));
    return this.httpClient.buildUrl(params);
  }

  getPath(
    ...args: IsPartial<TParams> extends true
      ? [params?: Maybe<TParams>]
      : [params: TParams]
  ): string {
    const params = this.configuration.params(args[0] ?? ({} as TParams));
    return params.path;
  }

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

  get tags() {
    return this.configuration.tags;
  }

  get path() {
    return this.configuration.path;
  }

  get pathDeclaration() {
    return this.path.join('/');
  }

  get operationId() {
    return this.configuration.operationId;
  }

  get group() {
    return this.configuration.group;
  }

  get namespace() {
    return this.configuration.namespace;
  }

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
  ) {
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
        }
      }
    } catch (error) {
      if (shouldThrow) {
        throw error;
      } else {
        console.warn(
          `[mobx-tanstack-query-api] ${label} contract validation threw for "${this.operationId}"`,
          error,
          payload,
        );
      }
    }
  }

  async request(
    ...args: IsPartial<TParams> extends true
      ? [params?: Maybe<TParams>]
      : [params: TParams]
  ) {
    const rawParams = (args[0] ?? {}) as TParams;

    const contracts = this.configuration.contracts;

    if (this.validateParams) {
      await this.validateContract(
        'params',
        contracts?.params as any,
        rawParams,
        {
          throw: this.throwParams,
        },
      );
    }

    const response = await this.httpClient.request<TResponse>(
      this.configuration.params(rawParams),
      this,
    );

    if (
      this.validateData &&
      contracts?.data?.safeParseAsync &&
      this.checkResponse(response) &&
      response.ok
    ) {
      try {
        await this.validateContract(
          'data',
          contracts?.data as any,
          response.data,
          { throw: this.throwData },
        );
      } catch (error) {
        if (this.throwData) {
          throw error;
        }
        console.warn(
          `[mobx-tanstack-query-api] Data contract validation threw for "${this.operationId}"`,
          error,
          (response as any)?.data,
        );
      }
    }

    return response;
  }

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

  toQueryKey(params?: Maybe<TParams>, uniqKey?: EndpointQueryUniqKey): any {
    return [
      ...this.configuration.path,
      this.configuration.operationId,
      params ?? {},
      callFunction(uniqKey),
    ];
  }

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

  toInfiniteQuery<
    TData = TResponse['data'],
    TError = DefaultError,
    TPageParam = unknown,
  >(
    options:
      | EndpointInfiniteQueryOptions<this, TData, TError, TPageParam>
      | (() => EndpointInfiniteQueryFlattenOptions<
          this,
          TData,
          TError,
          TPageParam
        >),
  ) {
    return new EndpointInfiniteQuery<this, TData, TError, TPageParam>(
      this,
      this.queryClient,
      options,
    );
  }
}
