/** biome-ignore-all lint/style/useShorthandFunctionType: this is special trick to add typings for callable class instance */
import type {
  DefaultError,
  InvalidateOptions,
  InvalidateQueryFilters,
} from '@tanstack/query-core';
import { callFunction } from 'yummies/common';
import type { AnyObject, IsPartial, Maybe } from 'yummies/utils/types';
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
import type { HttpClient, HttpResponse } from './http-client.js';

export interface Endpoint<
  TResponse extends HttpResponse<any, any>,
  TParams extends AnyObject,
  TMetaData extends AnyObject = AnyObject,
> {
  (
    ...args: IsPartial<TParams> extends true
      ? [params?: Maybe<TParams>]
      : [params: TParams]
  ): ReturnType<Endpoint<TResponse, TParams, TMetaData>['request']>;
}

export class Endpoint<
  TResponse extends HttpResponse<any, any>,
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

  constructor(
    public configuration: EndpointConfiguration<NoInfer<TParams>, TMetaData>,
    public queryClient: EndpointQueryClient,
    public httpClient: HttpClient,
  ) {
    this.endpointId = globalThis.crypto.randomUUID();
    this.meta = configuration.meta ?? ({} as TMetaData);
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

  request(
    ...args: IsPartial<TParams> extends true
      ? [params?: Maybe<TParams>]
      : [params: TParams]
  ) {
    return this.httpClient.request<TResponse>(
      this.configuration.params(args[0] ?? ({} as TParams)),
    );
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
    TError = DefaultError,
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
