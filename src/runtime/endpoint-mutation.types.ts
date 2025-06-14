import {
  MutationConfig,
  MutationInvalidateQueriesOptions,
} from 'mobx-tanstack-query';
import { AllPropertiesOptional, AnyObject } from 'yummies/utils/types';

import { InvalidateEndpointsFilters } from './endpoint-query-client.types.js';
import { AnyEndpoint } from './endpoint.types.js';

export interface EndpointMutationInvalidateQueriesOptions
  extends MutationInvalidateQueriesOptions {}

export type EndpointMutationParams<
  TParams extends AnyObject,
  TMutationMeta extends AnyObject | void = void,
> = TParams &
  (TMutationMeta extends void
    ? // eslint-disable-next-line @typescript-eslint/ban-types
      {}
    : AllPropertiesOptional<TMutationMeta> extends true
      ? { meta?: TMutationMeta }
      : { meta: TMutationMeta });

export type EndpointMutationOptions<
  TEndpoint extends AnyEndpoint,
  TData = unknown,
  TParams extends AnyObject = AnyObject,
  TMutationMeta extends AnyObject | void = void,
  TContext = unknown,
> = {
  invalidateEndpoints?: InvalidateEndpointsFilters;
  /**
   * Transform response to TData
   */
  transform?: (response: TEndpoint['__response']) => TData | Promise<TData>;
  invalidateQueries?:
    | EndpointMutationInvalidateQueriesOptions
    | ((
        data: NoInfer<TData>,
        payload: EndpointMutationParams<
          NoInfer<TParams>,
          NoInfer<TMutationMeta>
        >,
      ) => EndpointMutationInvalidateQueriesOptions | null | undefined);
} & Omit<
  MutationConfig<
    NoInfer<TData>,
    EndpointMutationParams<NoInfer<TParams>, NoInfer<TMutationMeta>>,
    TEndpoint['__response']['error'],
    TContext
  >,
  'queryClient' | 'mutationFn' | 'invalidateQueries'
>;
