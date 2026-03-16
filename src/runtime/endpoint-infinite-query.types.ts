import type {
  DefaultError,
  InfiniteData,
  QueryFunctionContext,
} from '@tanstack/query-core';
import type {
  InfiniteQueryConfig,
  InfiniteQueryDynamicOptions,
  InfiniteQueryOptions,
  InfiniteQueryUpdateOptions,
  IQueryClientCore,
} from 'mobx-tanstack-query';
import type { AnyObject, MaybeFalsy, MaybeFn } from 'yummies/types';
import type { Endpoint } from './endpoint.js';
import type { AnyEndpoint, ToEndpoint } from './endpoint.types.js';
import type { EndpointInfiniteQuery } from './endpoint-infinite-query.js';
import type {
  EndpointQueryUniqKey,
  ExcludedQueryKeys,
} from './endpoint-query.types.js';
import type { EndpointQueryClient } from './endpoint-query-client.js';

type ShortInfiniteQueryConfig<
  TQueryFnData,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
> = Omit<
  InfiniteQueryConfig<TQueryFnData, TError, TPageParam, TData, any[]>,
  ExcludedQueryKeys
> & {
  enabled?: boolean;
  queryClient?: EndpointQueryClient;
};

export type EndpointInfiniteQueryContext<TPageParam = unknown> = Omit<
  QueryFunctionContext<any, TPageParam>,
  'client'
> & {
  client: IQueryClientCore;
};

export type EndpointInfiniteQueryMergePageParam<
  TEndpoint extends AnyEndpoint,
  TPageParam = unknown,
> =
  | 'params'
  | 'body'
  | 'query'
  | 'headers'
  | ((
      params: NoInfer<TEndpoint['__params']>,
      pageParam: NoInfer<TPageParam>,
      context: EndpointInfiniteQueryContext<TPageParam>,
    ) => MaybeFalsy<TEndpoint['__params']>);

export type EndpointInfiniteQueryFlattenOptions<
  TEndpoint extends AnyEndpoint,
  TQueryFnData = TEndpoint['__response']['data'],
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
> = ShortInfiniteQueryConfig<
  NoInfer<TQueryFnData>,
  TError,
  TPageParam,
  TData
> & {
  uniqKey?: EndpointQueryUniqKey;

  params?: MaybeFalsy<TEndpoint['__params']>;
  /**
   * Merge `pageParam` into endpoint params before request.
   * Use string shortcuts for common cases or pass a function for custom shaping.
   */
  mergePageParam?: EndpointInfiniteQueryMergePageParam<
    TEndpoint,
    NoInfer<TPageParam>
  >;
  /**
   * Transform response to QueryFnData
   */
  transform?: (
    response: TEndpoint['__response'],
  ) => TQueryFnData | Promise<TQueryFnData>;
};

export type EndpointInfiniteQueryOptions<
  TEndpoint extends AnyEndpoint,
  TQueryFnData = TEndpoint['__response']['data'],
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
> = ShortInfiniteQueryConfig<
  NoInfer<TQueryFnData>,
  TError,
  TPageParam,
  TData
> & {
  uniqKey?: EndpointQueryUniqKey;

  params?: MaybeFn<MaybeFalsy<TEndpoint['__params']>, []>;
  /**
   * Merge `pageParam` into endpoint params before request.
   * Use string shortcuts for common cases or pass a function for custom shaping.
   */
  mergePageParam?: EndpointInfiniteQueryMergePageParam<
    TEndpoint,
    NoInfer<TPageParam>
  >;
  /**
   * Transform response to QueryFnData
   */
  transform?: (
    response: TEndpoint['__response'],
  ) => TQueryFnData | Promise<TQueryFnData>;
};

type EnhanceUpdatOptionVariant<
  TEndpoint extends AnyEndpoint,
  TVariant extends AnyObject,
> = Omit<TVariant, ExcludedQueryKeys> & {
  params?: MaybeFalsy<TEndpoint['__params']>;
};

export type EndpointInfiniteQueryUpdateOptionsAllVariants<
  TEndpoint extends AnyEndpoint,
  TQueryFnData = TEndpoint['__response']['data'],
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
> =
  | EnhanceUpdatOptionVariant<
      TEndpoint,
      Partial<
        InfiniteQueryOptions<TQueryFnData, TError, TPageParam, TData, any[]>
      >
    >
  | EnhanceUpdatOptionVariant<
      TEndpoint,
      InfiniteQueryUpdateOptions<TQueryFnData, TError, TPageParam, TData, any[]>
    >
  | EnhanceUpdatOptionVariant<
      TEndpoint,
      InfiniteQueryDynamicOptions<
        TQueryFnData,
        TError,
        TPageParam,
        TData,
        any[]
      >
    >;

export type ToEndpointInfiniteQuery<
  T extends AnyEndpoint,
  TQueryFnData = ToEndpoint<T>['__response']['data'],
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
> =
  T extends Endpoint<infer TResponse, any, any>
    ? EndpointInfiniteQuery<
        T,
        TResponse['data'],
        DefaultError,
        TPageParam,
        TData
      >
    : ToEndpointInfiniteQuery<AnyEndpoint>;
