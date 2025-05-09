import {
  MobxQuery,
  MobxQueryConfig,
  MobxQueryDynamicOptions,
} from 'mobx-tanstack-query';
import { FnValue } from 'yummies/common';
import { AnyObject, Maybe, MaybeFalsy } from 'yummies/utils/types';

import { AnyHttpResponse } from './http-client.js';

export interface EndpointQueryMeta {
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
  TResponse extends AnyHttpResponse,
  TInput extends AnyObject,
  TOutput = TResponse,
> = {
  input?: () => MaybeFalsy<TInput>;
} & Omit<
  MobxQueryConfig<TResponse, TResponse['error'], TOutput, TResponse, any[]>,
  'options' | 'queryFn' | 'queryClient' | 'queryKey'
> & {
    uniqKey?: EndpointQueryUnitKey;
    options?: (
      query: NoInfer<
        MobxQuery<
          NoInfer<TResponse>,
          NoInfer<TResponse['error']>,
          NoInfer<TOutput>,
          NoInfer<TResponse>,
          NoInfer<any[]>
        >
      >,
    ) => Omit<
      MobxQueryDynamicOptions<
        TResponse,
        TResponse['error'],
        TOutput,
        TResponse,
        any[]
      >,
      | 'queryKey'
      | 'queryFn'
      | 'queryHash'
      | '_defaulted'
      | 'experimental_prefetchInRender'
      | '_optimisticResults'
    >;
  };
