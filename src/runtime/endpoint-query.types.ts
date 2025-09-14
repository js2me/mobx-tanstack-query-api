import type { DefaultError } from '@tanstack/query-core';
import type { QueryConfig } from 'mobx-tanstack-query';
import type {
  AnyObject,
  Maybe,
  MaybeFalsy,
  MaybeFn,
} from 'yummies/utils/types';

import type { AnyEndpoint } from './endpoint.types.js';

export interface EndpointQueryMeta {
  endpointId: string;
  endpointQuery: true;
  tags: string[];
  operationId: string;
  path: string[];
  pathDeclaration: string;
  group?: string;
  namespace?: string;
}

export type EndpointQueryUniqKey = Maybe<
  MaybeFn<string | number | AnyObject | boolean>
>;

export type ExcludedQueryKeys =
  | 'options'
  | 'queryFn'
  | 'queryClient'
  | 'queryKey'
  | '_defaulted'
  | '_optimisticResults'
  | 'experimental_prefetchInRender'
  | 'enabled'
  | 'queryHash'
  | 'queryKeyHashFn';

type ShortQueryConfig<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
> = Omit<
  QueryConfig<TQueryFnData, TError, TData, TQueryData>,
  ExcludedQueryKeys
> & {
  enabled?: boolean;
};

export type EndpointQueryFlattenOptions<
  TEndpoint extends AnyEndpoint,
  TQueryFnData = TEndpoint['__response']['data'],
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
> = ShortQueryConfig<NoInfer<TQueryFnData>, TError, TData, TQueryData> & {
  uniqKey?: EndpointQueryUniqKey;

  params?: MaybeFalsy<TEndpoint['__params']>;
  /**
   * Transform response to QueryFnData
   */
  transform?: (
    response: TEndpoint['__response'],
  ) => TQueryFnData | Promise<TQueryFnData>;
};

export type EndpointQueryOptions<
  TEndpoint extends AnyEndpoint,
  TQueryFnData = TEndpoint['__response']['data'],
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
> = ShortQueryConfig<NoInfer<TQueryFnData>, TError, TData, TQueryData> & {
  uniqKey?: EndpointQueryUniqKey;

  params?: MaybeFn<MaybeFalsy<TEndpoint['__params']>, []>;
  /**
   * Transform response to QueryFnData
   */
  transform?: (
    response: TEndpoint['__response'],
  ) => TQueryFnData | Promise<TQueryFnData>;
};
