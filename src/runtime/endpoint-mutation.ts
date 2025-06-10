import {
  Mutation,
  MutationConfig,
  MutationInvalidateQueriesOptions,
} from 'mobx-tanstack-query';
import { AllPropertiesOptional, AnyObject, Maybe } from 'yummies/utils/types';

import { EndpointQueryClient } from './endpoint-query-client.js';
import { AnyEndpoint } from './endpoint.types.js';
import { AnyHttpResponse } from './http-client.js';

export interface EndpointMutationInvalidateQueriesOptions
  extends MutationInvalidateQueriesOptions {
  invalidateTags?: string[];
}

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
  invalidateQueries?:
    | EndpointMutationInvalidateQueriesOptions
    | ((
        data: NoInfer<TOutput>,
        payload: EndpointMutationInput<NoInfer<TInput>, NoInfer<TMutationMeta>>,
      ) => EndpointMutationInvalidateQueriesOptions | null | undefined);
} & Omit<
  MutationConfig<
    NoInfer<TOutput>,
    EndpointMutationInput<NoInfer<TInput>, NoInfer<TMutationMeta>>,
    NoInfer<TResponse>['error']
  >,
  'queryClient' | 'mutationFn' | 'invalidateQueries'
>;

export class EndpointMutation<
  TOutput,
  TInput extends AnyObject,
  TResponse extends AnyHttpResponse,
  TMutationMeta extends AnyObject | void = void,
> extends Mutation<
  TOutput,
  EndpointMutationInput<TInput, TMutationMeta>,
  TResponse['error']
> {
  constructor(
    private endpoint: AnyEndpoint,
    queryClient: EndpointQueryClient,
    {
      transform: transformResponse,
      invalidateQueries,
      ...mutationOptions
    }: EndpointMutationOptions<TOutput, TInput, TResponse, TMutationMeta>,
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

        let output = response.data as TOutput;

        if (transformResponse) {
          output = await transformResponse(response as TResponse);
        }

        return output;
      },
    });
  }
}
