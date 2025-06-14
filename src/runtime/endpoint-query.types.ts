import { DefaultError } from '@tanstack/query-core';
import { QueryConfig } from 'mobx-tanstack-query';
import { FnValue } from 'yummies/common';
import { AnyObject, Maybe, MaybeFalsy } from 'yummies/utils/types';

import { AnyEndpoint } from './endpoint.types.js';

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

export type EndpointQueryUnitKey = Maybe<
  FnValue<string | number | AnyObject | boolean>
>;

export type EndpointQueryOptions<
  TEndpoint extends AnyEndpoint,
  TQueryFnData = TEndpoint['__response']['data'],
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
> = {
  params?: () => MaybeFalsy<TEndpoint['__params']>;
  /**
   * Transform response to QueryFnData
   */
  transform?: (
    response: TEndpoint['__response'],
  ) => TQueryFnData | Promise<TQueryFnData>;
} & Omit<
  QueryConfig<NoInfer<TQueryFnData>, TError, TData, TQueryData>,
  | 'options'
  | 'queryFn'
  | 'queryClient'
  | 'queryKey'
  | '_defaulted'
  | '_optimisticResults'
  | 'experimental_prefetchInRender'
  | 'enabled'
  | 'queryHash'
  | 'queryKeyHashFn'
> & {
    uniqKey?: EndpointQueryUnitKey;
    enabled?: boolean;
  };
