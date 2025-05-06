/* eslint-disable @typescript-eslint/ban-ts-comment */
import { QueryFunctionContext } from '@tanstack/query-core';
import { makeObservable, observable, runInAction, when } from 'mobx';
import {
  MobxQuery,
  MobxQueryConfig,
  MobxQueryDynamicOptions,
} from 'mobx-tanstack-query';
import { MaybeFalsy, Unpromise } from 'yummies/utils/types';

import { EndpointQueryClient } from './endpoint-query-client.js';
import {
  AnyEndpoint,
  InferEndpointError,
  InferEndpointInput,
  InferEndpointResponse,
} from './endpoint.types.js';

export type EndpointQueryOptions<TOutput, TEndpoint extends AnyEndpoint> = {
  input: () => MaybeFalsy<InferEndpointInput<TEndpoint>>;
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
        const input = getInput();
        return EndpointQuery.buildOptionsFromInput(
          endpoint,
          willEnableManually && input,
        );
      },
      queryFn: async (ctx): Promise<TOutput> => {
        runInAction(() => {
          this.response = null;
        });
        const args = this.buildParamsFromContext(ctx as any);
        const requestParamsIndex = args.length - 1;

        if (args[requestParamsIndex]) {
          if (!args[requestParamsIndex].signal) {
            args[requestParamsIndex].signal = ctx.signal;
          }
        } else {
          args[requestParamsIndex] = { signal: ctx.signal };
        }

        // @ts-ignore
        const response = await endpoint.request(...args);

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
    // @ts-ignore
    this.update(this.buildOptionsFromInput(input));
    await when(() => !this.result.isFetching);
    // @ts-ignore
    return this.result.data!;
  }

  static buildOptionsFromInput(endpoint: AnyEndpoint, input: any) {
    return {
      enabled: !!input,
      queryKey: input ? endpoint.getQueryKey(input) : (['__SKIP__'] as any),
    };
  }

  protected buildOptionsFromInput(
    input: MaybeFalsy<InferEndpointInput<TEndpoint>>,
  ): MobxQueryDynamicOptions<
    Unpromise<InferEndpointResponse<TEndpoint>>,
    InferEndpointError<TEndpoint>
  > {
    return EndpointQuery.buildOptionsFromInput(this.endpoint, input);
  }

  protected buildParamsFromContext(ctx: QueryFunctionContext<any, any>) {
    const input = this.endpoint.getQueryKey(ctx.queryKey);
    return this.endpoint.getParamsFromInput(input);
  }
}
