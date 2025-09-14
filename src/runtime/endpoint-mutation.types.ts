import type {
  MutationConfig,
  MutationInvalidateQueriesOptions,
} from 'mobx-tanstack-query';
import type { AnyObject, IsPartial, Maybe } from 'yummies/utils/types';
import type { AnyEndpoint } from './endpoint.types.js';
import type { InvalidateEndpointsFilters } from './endpoint-query-client.types.js';

export interface EndpointMutationInvalidateQueriesOptions
  extends MutationInvalidateQueriesOptions {}

export type EndpointMutationParams<
  TParams extends AnyObject,
  TMutationMeta extends AnyObject | void = void,
> = TParams &
  (TMutationMeta extends void
    ? {}
    : IsPartial<TMutationMeta> extends true
      ? { meta?: Maybe<TMutationMeta> }
      : { meta: TMutationMeta });

export type EndpointMutationOptions<
  TEndpoint extends AnyEndpoint,
  TData = unknown,
  TParams extends AnyObject = AnyObject,
  TMutationMeta extends AnyObject | void = void,
  TContext = unknown,
> = {
  /**
   * Invalidates query endpoints using various filters based on data from the OpenAPI schema
   *
   * The value `by-group` will invalidate query endpoints that belong to the exact same group as the mutation
   *
   * The value `by-tag` will invalidate query endpoints that contain at least one tag described in the endpoint with the mutation
   *
   * The value `true` will use dynamic definition of `by-group` | `by-tag` values.
   * If there is a group, it will use `by-group` invalidation, if there is a tag then `by-tag`
   */
  invalidateEndpoints?:
    | true
    | 'by-group'
    | 'by-tag'
    | InvalidateEndpointsFilters;
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
