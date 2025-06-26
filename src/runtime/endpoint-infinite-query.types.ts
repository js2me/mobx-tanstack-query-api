import { DefaultError, QueryKey } from '@tanstack/query-core';
import { InfiniteQueryConfig } from 'mobx-tanstack-query';
import { MaybeFalsy, RequiredKeys } from 'yummies/utils/types';

import {
  EndpointQueryUniqKey,
  ExcludedQueryKeys,
} from './endpoint-query.types.js';
import { AnyEndpoint } from './endpoint.types.js';

type ShortInfiniteQueryConfig<
  TQueryFnData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
  TPageParam = unknown,
> = Omit<
  RequiredKeys<
    InfiniteQueryConfig<TQueryFnData, TError, TQueryKey, TPageParam>,
    'getNextPageParam'
  >,
  ExcludedQueryKeys
> & {
  enabled?: boolean;
};

export type EndpointInfiniteQueryFlattenOptions<
  TEndpoint extends AnyEndpoint,
  TData = TEndpoint['__response']['data'],
  TError = DefaultError,
  TPageParam = unknown,
> = ShortInfiniteQueryConfig<NoInfer<TData>, TError, any[], TPageParam> & {
  uniqKey?: EndpointQueryUniqKey;

  params?: MaybeFalsy<TEndpoint['__params']>;
  /**
   * Transform response to QueryFnData
   */
  transform?: (response: TEndpoint['__response']) => TData | Promise<TData>;
};

export type EndpointInfiniteQueryOptions<
  TEndpoint extends AnyEndpoint,
  TData = TEndpoint['__response']['data'],
  TError = DefaultError,
  TPageParam = unknown,
> = ShortInfiniteQueryConfig<NoInfer<TData>, TError, any[], TPageParam> & {
  uniqKey?: EndpointQueryUniqKey;

  params?: () => MaybeFalsy<TEndpoint['__params']>;
  /**
   * Transform response to QueryFnData
   */
  transform?: (response: TEndpoint['__response']) => TData | Promise<TData>;
};
