import { Mutation } from 'mobx-tanstack-query';
import type { AnyObject, Maybe } from 'yummies/utils/types';
import type { AnyEndpoint } from './endpoint.types.js';
import type {
  EndpointMutationOptions,
  EndpointMutationParams,
} from './endpoint-mutation.types.js';
import type { EndpointQueryClient } from './endpoint-query-client.js';
import type { InvalidateEndpointsFilters } from './endpoint-query-client.types.js';
import type { RequestParams } from './http-client.js';

/**
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoint-mutations/)
 */
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
        let requestParams = input?.requestParams as Maybe<RequestParams>;

        if (requestParams) {
          if (!requestParams.signal) {
            requestParams.signal = this.abortController.signal;
          }
        } else {
          requestParams = { signal: this.abortController.signal };
        }

        const fixedInput = {
          ...input,
          requestParams,
        };

        const response = await endpoint.request(fixedInput);
        return (await transformResponse?.(response)) ?? response.data;
      },
    });
  }
}
