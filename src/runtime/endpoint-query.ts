/* eslint-disable @typescript-eslint/ban-ts-comment */
import { QueryFunctionContext } from '@tanstack/query-core';
import { makeObservable, observable, runInAction, when } from 'mobx';
import { MobxQuery } from 'mobx-tanstack-query';
import { AnyObject, Maybe, MaybeFalsy } from 'yummies/utils/types';

import { EndpointQueryClient } from './endpoint-query-client.js';
import {
  EndpointQueryMeta,
  EndpointQueryOptions,
} from './endpoint-query.types.js';
import { AnyEndpoint } from './endpoint.types.js';
import { AnyHttpResponse, RequestParams } from './http-client.js';

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
> extends MobxQuery<NoInfer<TOutput>, NoInfer<TResponse>['error']> {
  response: TResponse | null = null;

  constructor(
    private endpoint: AnyEndpoint,
    queryClient: EndpointQueryClient,
    {
      input: getInput,
      transform: transformResponse,
      ...queryOptions
    }: EndpointQueryOptions<TOutput, TInput, TResponse>,
  ) {
    super({
      ...queryOptions,
      queryClient,
      meta: {
        ...queryOptions.meta,
        tags: endpoint.tags,
        operationId: endpoint.operationId,
        path: endpoint.path,
        pathDeclaration: endpoint.path.join('/'),
        endpointQuery: true,
      } satisfies EndpointQueryMeta,
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
    return (ctx.queryKey.at(-1) || {}) as TInput;
  }
}
