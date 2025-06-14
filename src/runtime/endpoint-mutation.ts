import { Mutation } from 'mobx-tanstack-query';
import { AnyObject, Maybe } from 'yummies/utils/types';

import {
  EndpointMutationParams,
  EndpointMutationInvalidateQueriesOptions,
  EndpointMutationOptions,
} from './endpoint-mutation.types.js';
import { EndpointQueryClient } from './endpoint-query-client.js';
import { AnyEndpoint } from './endpoint.types.js';

export class EndpointMutation<
  TEndpoint extends AnyEndpoint,
  TData = unknown,
  TParams extends AnyObject = AnyObject,
  TMutationMeta extends AnyObject | void = void,
  TContext = unknown,
> extends Mutation<
  TData,
  EndpointMutationParams<TParams, TMutationMeta>,
  TEndpoint['__response']['error'],
  TContext
> {
  constructor(
    private endpoint: AnyEndpoint,
    queryClient: EndpointQueryClient,
    {
      transform: transformResponse,
      invalidateQueries,
      ...mutationOptions
    }: EndpointMutationOptions<
      TEndpoint,
      TData,
      TParams,
      TMutationMeta,
      TContext
    >,
  ) {
    super({
      ...mutationOptions,
      queryClient,
      invalidateQueries: (data, payload) => {
        if (!invalidateQueries) {
          return null;
        }

        let options: Maybe<EndpointMutationInvalidateQueriesOptions>;

        if (typeof invalidateQueries === 'function') {
          options = invalidateQueries(data, payload);
        } else {
          options = invalidateQueries;
        }

        if (!options) {
          return null;
        }

        let skipInvalidate = false;

        if (options.invalidateTags?.length) {
          queryClient.invalidateByTags(options.invalidateTags, options);
          skipInvalidate = true;
        }

        if (skipInvalidate) {
          return null;
        }

        return options;
      },
      mutationFn: async (input) => {
        const response = await endpoint.request(input);
        return (await transformResponse?.(response)) ?? response.data;
      },
    });
  }
}
