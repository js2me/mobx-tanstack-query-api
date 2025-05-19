/* eslint-disable @typescript-eslint/ban-ts-comment */
import { QueryFunctionContext } from '@tanstack/query-core';
import { makeObservable, observable, runInAction, when } from 'mobx';
import { MobxQuery } from 'mobx-tanstack-query';
import { AnyObject, Maybe, MaybeFalsy } from 'yummies/utils/types';

import { EndpointQueryClient } from './endpoint-query-client.js';
import {
  EndpointQueryMeta,
  EndpointQueryOptions,
  EndpointQueryUnitKey,
} from './endpoint-query.types.js';
import { AnyEndpoint } from './endpoint.types.js';
import { AnyHttpResponse, RequestParams } from './http-client.js';

const buildOptionsFromInput = (
  endpoint: AnyEndpoint,
  input: MaybeFalsy<AnyObject>,
  uniqKey?: EndpointQueryUnitKey,
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
    queryKey: endpoint.getQueryKey(input || {}, uniqKey),
  };
};

export class EndpointQuery<
  TResponse extends AnyHttpResponse,
  TInput extends AnyObject,
  TOutput = TResponse,
> extends MobxQuery<TResponse, TResponse['error'], TOutput, TResponse, any[]> {
  response: TResponse | null = null;

  constructor(
    private endpoint: AnyEndpoint,
    queryClient: EndpointQueryClient,
    {
      input: getInput,
      options: getDynamicOptions,
      uniqKey,
      ...queryOptions
    }: EndpointQueryOptions<TResponse, TInput, TOutput>,
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
      options: (query): any => {
        const willEnableManually = queryOptions.enabled === false;
        const input = (getInput?.() || {}) as Partial<TInput>;
        const builtOptions = buildOptionsFromInput(endpoint, input, uniqKey);
        const dynamicOuterOptions = getDynamicOptions?.(query);

        let isEnabled = false;

        if (willEnableManually) {
          if (dynamicOuterOptions?.enabled != null) {
            isEnabled = dynamicOuterOptions.enabled;
          }
        } else {
          const outerDynamicEnabled =
            dynamicOuterOptions?.enabled == null ||
            !!dynamicOuterOptions.enabled;

          isEnabled = builtOptions.enabled && outerDynamicEnabled;
        }

        return {
          ...query.options,
          ...builtOptions,
          ...dynamicOuterOptions,
          enabled: isEnabled,
        } as any;
      },
      queryFn: async (ctx): Promise<any> => {
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

        const output = response.data as TOutput;

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
