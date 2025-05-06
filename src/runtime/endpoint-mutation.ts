import { MobxMutation, MobxMutationConfig } from 'mobx-tanstack-query';
import {
  AllPropertiesOptional,
  AnyObject,
  Unpromise,
} from 'yummies/utils/types';

import { EndpointQueryClient } from './endpoint-query-client.js';
import {
  AnyEndpoint,
  InferEndpointError,
  InferEndpointInput,
  InferEndpointResponse,
} from './endpoint.types.js';

export type EndpointMutationInput<
  TBaseInput extends AnyObject,
  TMutationMeta extends AnyObject | void = void,
> = TBaseInput &
  (TMutationMeta extends void
    ? // eslint-disable-next-line @typescript-eslint/ban-types
      {}
    : AllPropertiesOptional<TMutationMeta> extends true
      ? { meta?: TMutationMeta }
      : { meta: TMutationMeta });

export interface EndpointMutationOptions<
  TEndpoint extends AnyEndpoint,
  TMutationMeta extends AnyObject | void = void,
> extends Omit<
    MobxMutationConfig<
      Unpromise<InferEndpointResponse<TEndpoint>>,
      EndpointMutationInput<InferEndpointInput<TEndpoint>, TMutationMeta>,
      InferEndpointError<TEndpoint>
    >,
    'queryClient' | 'mutationFn'
  > {}

export class EndpointMutation<
  TEndpoint extends AnyEndpoint,
  TMutationMeta extends AnyObject | void = void,
> extends MobxMutation<
  Unpromise<InferEndpointResponse<TEndpoint>>,
  EndpointMutationInput<InferEndpointInput<TEndpoint>, TMutationMeta>
> {
  constructor(
    private endpoint: TEndpoint,
    queryClient: EndpointQueryClient,
    options: EndpointMutationOptions<TEndpoint, TMutationMeta>,
  ) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    super({
      ...options,
      queryClient,
      mutationFn: async (input) => {
        const response = await endpoint.request(input);
        return response as any;
      },
    });
  }
}
