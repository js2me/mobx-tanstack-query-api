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
}

export type EndpointQueryUnitKey = Maybe<
  FnValue<string | number | AnyObject | boolean>
>;

export type EndpointQueryOptions<
  TEndpoint extends AnyEndpoint,
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
> = {
  input?: () => MaybeFalsy<TEndpoint['__input_type']>;
} & Omit<
  QueryConfig<TQueryFnData, TError, TData, TQueryData>,
  'options' | 'queryFn' | 'queryClient' | 'queryKey'
> & {
    uniqKey?: EndpointQueryUnitKey;
  };
