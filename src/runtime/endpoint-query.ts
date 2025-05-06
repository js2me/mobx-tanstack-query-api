/* eslint-disable @typescript-eslint/ban-ts-comment */
import { QueryFunctionContext } from '@tanstack/query-core';
import { makeObservable, observable, runInAction, when } from 'mobx';
import { MobxQuery, MobxQueryConfig } from 'mobx-tanstack-query';
import { Maybe, MaybeFalsy, Unpromise } from 'yummies/utils/types';

import { EndpointQueryClient } from './endpoint-query-client.js';
import {
  AnyEndpoint,
  InferEndpointError,
  InferEndpointInput,
  InferEndpointResponse,
} from './endpoint.types.js';
import { RequestParams } from './http-client.js';

export type EndpointQueryOptions<TOutput, TEndpoint extends AnyEndpoint> = {
  input?: () => MaybeFalsy<InferEndpointInput<TEndpoint>>;
  transform?: (
    response: Unpromise<InferEndpointResponse<TEndpoint>>,
  ) => TOutput;
} & Omit<
  MobxQueryConfig<TOutput, InferEndpointError<TEndpoint>>,
  'options' | 'queryFn' | 'queryClient'
>;

export class EndpointQuery<
  TOutput,
  TEndpoint extends AnyEndpoint,
> extends MobxQuery<TOutput, InferEndpointError<TEndpoint>> {
  response: Unpromise<InferEndpointResponse<TEndpoint>> | null = null;

  constructor(
    private endpoint: TEndpoint,
    queryClient: EndpointQueryClient,
    {
      input: getInput,
      ...queryOptions
    }: EndpointQueryOptions<TOutput, TEndpoint>,
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
        const input = (getInput?.() || {}) as Partial<
          InferEndpointInput<TEndpoint>
        >;
        const builtOptions = this.buildOptionsFromInput(input);

        return {
          ...options,
          ...builtOptions,
          enabled: willEnableManually ? false : builtOptions.enabled,
        };
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
          this.response = response as Unpromise<
            InferEndpointResponse<TEndpoint>
          >;
        });

        return response.data as Unpromise<
          InferEndpointResponse<TEndpoint>
        >['data'];
      },
    });

    observable.ref(this, 'lastResponse');
    makeObservable(this);
  }

  async setInput(
    input: MaybeFalsy<InferEndpointInput<TEndpoint>>,
  ): Promise<Unpromise<InferEndpointResponse<TEndpoint>>> {
    this.update(this.buildOptionsFromInput(input));
    await when(() => !this.result.isFetching);
    // @ts-ignore
    return this.result.data!;
  }

  buildOptionsFromInput(
    input: MaybeFalsy<Partial<InferEndpointInput<TEndpoint>>>,
  ) {
    const { requiredParams } = this.endpoint.configuration;
    let hasRequiredParams = false;

    if (requiredParams.length > 0) {
      hasRequiredParams =
        !!input && requiredParams.every((param) => param in input);
    } else {
      hasRequiredParams = true;
    }

    return {
      enabled: hasRequiredParams,
      queryKey: this.endpoint.getQueryKey(input || {}),
    };
  }

  protected getInputFromContext(ctx: QueryFunctionContext<any, any>) {
    return (ctx.queryKey[2] || {}) as InferEndpointInput<TEndpoint>;
  }
}
