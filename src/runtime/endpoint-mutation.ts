import { Mutation } from 'mobx-tanstack-query';
import { AnyObject } from 'yummies/utils/types';

import {
  EndpointMutationParams,
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
          queryClient.invalidateEndpoints(invalidateEndpoints);
        }
      },
      mutationFn: async (input) => {
        const response = await endpoint.request(input);
        return (await transformResponse?.(response)) ?? response.data;
      },
    });
  }
}
