import { MobxMutation, MobxMutationConfig } from 'mobx-tanstack-query';
import { AllPropertiesOptional, AnyObject } from 'yummies/utils/types';

import { EndpointQueryClient } from './endpoint-query-client.js';
import { AnyEndpoint } from './endpoint.types.js';
import { AnyHttpResponse } from './http-client.js';

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

export type EndpointMutationOptions<
  TOutput,
  TInput extends AnyObject,
  TResponse extends AnyHttpResponse,
  TMutationMeta extends AnyObject | void = void,
> = {
  transform?: (response: TResponse) => TOutput | Promise<TOutput>;
} & Omit<
  MobxMutationConfig<
    NoInfer<TOutput>,
    EndpointMutationInput<NoInfer<TInput>, NoInfer<TMutationMeta>>,
    NoInfer<TResponse>['error']
  >,
  'queryClient' | 'mutationFn'
>;

export class EndpointMutation<
  TOutput,
  TInput extends AnyObject,
  TResponse extends AnyHttpResponse,
  TMutationMeta extends AnyObject | void = void,
> extends MobxMutation<
  TOutput,
  EndpointMutationInput<TInput, TMutationMeta>,
  TResponse['error']
> {
  constructor(
    private endpoint: AnyEndpoint,
    queryClient: EndpointQueryClient,
    {
      transform: transformResponse,
      ...mutationOptions
    }: EndpointMutationOptions<TOutput, TInput, TResponse, TMutationMeta>,
  ) {
    super({
      ...mutationOptions,
      queryClient,
      mutationFn: async (input) => {
        const response = await endpoint.request(input);

        let output = response.data as TOutput;

        if (transformResponse) {
          output = await transformResponse(response as TResponse);
        }

        return output;
      },
    });
  }
}
