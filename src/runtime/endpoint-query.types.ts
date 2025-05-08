import { MobxQueryConfig } from 'mobx-tanstack-query';
import { AnyObject, MaybeFalsy } from 'yummies/utils/types';

import { AnyHttpResponse } from './http-client.js';

export interface EndpointQueryMeta {
  endpointQuery: true;
  tags: string[];
  operationId: string;
  path: string[];
  pathDeclaration: string;
}

export type EndpointQueryOptions<
  TOutput,
  TInput extends AnyObject,
  TResponse extends AnyHttpResponse,
> = {
  input?: () => MaybeFalsy<TInput>;
  transform?: (response: TResponse) => TOutput | Promise<TOutput>;
} & Omit<
  MobxQueryConfig<NoInfer<TOutput>, NoInfer<TResponse>['error']>,
  'options' | 'queryFn' | 'queryClient'
>;
