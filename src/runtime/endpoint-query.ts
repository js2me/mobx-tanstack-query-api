/* eslint-disable @typescript-eslint/ban-ts-comment */
import { QueryClient, QueryFunctionContext } from '@tanstack/query-core';
import { when } from 'mobx';
import {
  MobxQuery,
  MobxQueryConfig,
  MobxQueryDynamicOptions,
} from 'mobx-tanstack-query';
import { MaybeFalsy } from 'yummies/utils/types';

import {
  AnyEndpoint,
  InferEndpointError,
  InferEndpointInput,
  InferEndpointResponse,
} from './endpoint.types.js';

export interface EndpointQueryOptions<TEndpoint extends AnyEndpoint>
  extends Omit<
    MobxQueryConfig<
      InferEndpointResponse<TEndpoint>,
      InferEndpointError<TEndpoint>
    >,
    'options' | 'queryFn' | 'queryClient'
  > {
  input: () => MaybeFalsy<InferEndpointInput<TEndpoint>>;
}

export class EndpointQuery<TEndpoint extends AnyEndpoint> extends MobxQuery<
  InferEndpointResponse<TEndpoint>,
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
        const willEnableManually = options.enabled === false;
        const input = getInput();
        return this.buildOptionsFromInput(willEnableManually && input);
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
        return response as InferEndpointResponse<TEndpoint>;
      },
    });
  }

  async setInput(
    input: MaybeFalsy<InferEndpointInput<TEndpoint>>,
  ): Promise<InferEndpointResponse<TEndpoint>> {
    this.update(this.buildOptionsFromInput(input));
    await when(() => !this.result.isFetching);
    return this.result.data!;
  }

  protected buildOptionsFromInput(
    input: MaybeFalsy<InferEndpointInput<TEndpoint>>,
  ): MobxQueryDynamicOptions<
    InferEndpointResponse<TEndpoint>,
    InferEndpointError<TEndpoint>
  > {
    return {
      enabled: !!input,
      queryKey: input ? this.endpoint.getQueryKey(input) : ('__SKIP__' as any),
    };
  }

  protected buildParamsFromContext(ctx: QueryFunctionContext<any, any>) {
    const input = this.endpoint.getQueryKey(ctx.queryKey);
    return this.endpoint.getParamsFromInput(input);
  }
}
