/* eslint-disable @typescript-eslint/ban-ts-comment */
import { QueryFunctionContext } from '@tanstack/query-core';
import { makeObservable, observable, runInAction, when } from 'mobx';
import { MobxQuery, MobxQueryConfig } from 'mobx-tanstack-query';
import { AnyObject, Maybe, MaybeFalsy } from 'yummies/utils/types';

import { EndpointQueryClient } from './endpoint-query-client.js';
import { AnyEndpoint } from './endpoint.types.js';
import { AnyHttpResponse, RequestParams } from './http-client.js';

export type EndpointQueryOptions<
  TOutput,
  TInput extends AnyObject,
  TResponse extends AnyHttpResponse,
  TError,
> = {
  input?: () => MaybeFalsy<TInput>;
  transform?: (response: TResponse) => TOutput | Promise<TOutput>;
} & Omit<
  MobxQueryConfig<NoInfer<TOutput>, NoInfer<TError>>,
  'options' | 'queryFn' | 'queryClient'
>;

const buildOptionsFromInput = (
  endpoint: AnyEndpoint,
  input: MaybeFalsy<AnyObject>,
) => {
  const { requiredParams } = endpoint.configuration;
  let hasRequiredParams = false;

  if (requiredParams.length > 0) {
    hasRequiredParams =
      !!input && requiredParams.every((param) => param in input);
  } else {
    hasRequiredParams = true;
  }

  return {
    enabled: hasRequiredParams,
    queryKey: endpoint.getQueryKey(input || {}),
  };
};

export class EndpointQuery<
  TOutput,
  TInput extends AnyObject,
  TResponse extends AnyHttpResponse,
  TError,
> extends MobxQuery<NoInfer<TOutput>, NoInfer<TError>> {
  response: TResponse | null = null;

  constructor(
    private endpoint: AnyEndpoint,
    queryClient: EndpointQueryClient,
    {
      input: getInput,
      transform: transformResponse,
      ...queryOptions
    }: EndpointQueryOptions<TOutput, TInput, TResponse, TError>,
  ) {
    super({
      ...queryOptions,
      queryClient,
      meta: {
        tags: endpoint.tags,
        operationId: endpoint.operationId,
        ...queryOptions.meta,
      },
      options: ({ options }) => {
        const willEnableManually = options?.enabled === false;
        const input = (getInput?.() || {}) as Partial<TInput>;
        const builtOptions = buildOptionsFromInput(endpoint, input);

        return {
          ...options,
          ...builtOptions,
          enabled: willEnableManually ? false : builtOptions.enabled,
        } as any;
      },
      queryFn: async (ctx): Promise<TOutput> => {
        runInAction(() => {
          this.response = null;
        });

        const input = this.getInputFromContext(ctx as any);

        let requestParams = input.request as Maybe<RequestParams>;

        if (requestParams) {
          if (!requestParams.signal) {
            requestParams.signal = ctx.signal;
          }
        } else {
          requestParams = { signal: ctx.signal };
        }

        const fixedInput = {
          ...input,
          request: requestParams,
        };

        const response = await endpoint.request(fixedInput);

        runInAction(() => {
          this.response = response as TResponse;
        });

        let output = response.data as TOutput;

        if (transformResponse) {
          output = await transformResponse(response as TResponse);
        }

        return output;
      },
    });

    observable.ref(this, 'lastResponse');
    makeObservable(this);
  }

  async setInput(input: MaybeFalsy<TInput>): Promise<TResponse> {
    this.update(buildOptionsFromInput(this.endpoint, input));
    await when(() => !this.result.isFetching);
    // @ts-ignore
    return this.result.data!;
  }

  protected getInputFromContext(ctx: QueryFunctionContext<any, any>) {
    return (ctx.queryKey[2] || {}) as TInput;
  }
}
