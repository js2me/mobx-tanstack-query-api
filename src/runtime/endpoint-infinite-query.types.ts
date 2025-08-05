import { DefaultError, InfiniteData } from '@tanstack/query-core';
import {
  InfiniteQueryConfig,
  InfiniteQueryDynamicOptions,
  InfiniteQueryOptions,
  InfiniteQueryUpdateOptions,
} from 'mobx-tanstack-query';
import { AnyObject, MaybeFalsy } from 'yummies/utils/types';

import {
  EndpointQueryUniqKey,
  ExcludedQueryKeys,
} from './endpoint-query.types.js';
import { AnyEndpoint } from './endpoint.types.js';

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
};

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

  params: (pageParam: NoInfer<TPageParam>) => MaybeFalsy<TEndpoint['__params']>;
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

  params: (pageParam: NoInfer<TPageParam>) => MaybeFalsy<TEndpoint['__params']>;
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
