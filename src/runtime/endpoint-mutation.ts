import { Mutation } from 'mobx-tanstack-query';
import type { AnyObject, Maybe } from 'yummies/utils/types';
import type { AnyEndpoint } from './endpoint.types.js';
import type {
  EndpointMutationOptions,
  EndpointMutationParams,
} from './endpoint-mutation.types.js';
import type { EndpointQueryClient } from './endpoint-query-client.js';
import type { InvalidateEndpointsFilters } from './endpoint-query-client.types.js';

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
      invalidateEndpoints,
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
      onSuccess: (data, variables, context) => {
        mutationOptions.onSuccess?.(data, variables, context);
        if (invalidateEndpoints) {
          if (typeof invalidateEndpoints === 'object') {
            queryClient.invalidateEndpoints(invalidateEndpoints);
          } else {
            let filters: Maybe<InvalidateEndpointsFilters>;
            switch (`${invalidateEndpoints}`) {
              case 'true': {
                filters = endpoint.group
                  ? {
                      group: endpoint.group,
                    }
                  : {
                      tag: endpoint.tags,
                    };

                break;
              }
              case 'by-group': {
                filters = {
                  group: endpoint.group,
                };

                break;
              }
              case 'by-tag': {
                filters = {
                  tag: endpoint.tags,
                };

                break;
              }
            }

            if (filters) {
              queryClient.invalidateEndpoints(filters);
            }
          }
        }
      },
      mutationFn: async (input) => {
        const response = await endpoint.request(input);
        return (await transformResponse?.(response)) ?? response.data;
      },
    });
  }
}
