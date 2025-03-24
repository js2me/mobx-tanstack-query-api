/* eslint-disable @typescript-eslint/ban-ts-comment */
import { QueryClient, QueryFunctionContext } from '@tanstack/query-core';
import { when } from 'mobx';
import {
  MobxQuery,
  MobxQueryConfig,
  MobxQueryDynamicOptions,
} from 'mobx-tanstack-query';
import { MaybeFalsy, Unpromise } from 'yummies/utils/types';

import {
  AnyEndpoint,
  InferEndpointError,
  InferEndpointInput,
  InferEndpointResponse,
} from './endpoint.types.js';

export interface EndpointQueryOptions<TEndpoint extends AnyEndpoint>
  extends Omit<
    MobxQueryConfig<
      Unpromise<InferEndpointResponse<TEndpoint>>,
      InferEndpointError<TEndpoint>
    >,
    'options' | 'queryFn' | 'queryClient'
  > {
  input: () => MaybeFalsy<InferEndpointInput<TEndpoint>>;
}

export class EndpointQuery<TEndpoint extends AnyEndpoint> extends MobxQuery<
  Unpromise<InferEndpointResponse<TEndpoint>>,
  InferEndpointError<TEndpoint>
> {
  constructor(
    private endpoint: TEndpoint,
    queryClient: QueryClient,
    { input: getInput, ...queryOptions }: EndpointQueryOptions<TEndpoint>,
  ) {
    super({
      ...queryOptions,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
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
      queryFn: async (ctx) => {
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
        return response as Unpromise<InferEndpointResponse<TEndpoint>>;
      },
    });
  }

  get response() {
    if (this.options.queryKey[0] === '__SKIP__') {
      return null;
    }
    return this.result.data?.data ?? null;
  }

  async setInput(
    input: MaybeFalsy<InferEndpointInput<TEndpoint>>,
  ): Promise<Unpromise<InferEndpointResponse<TEndpoint>>> {
    this.update(this.buildOptionsFromInput(input));
    await when(() => !this.result.isFetching);
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
