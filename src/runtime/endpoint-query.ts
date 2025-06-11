/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  DefaultError,
  QueryFunctionContext,
  QueryObserverResult,
  skipToken,
} from '@tanstack/query-core';
import { makeObservable, observable, runInAction } from 'mobx';
import { Query } from 'mobx-tanstack-query';
import { AnyObject, Maybe, MaybeFalsy } from 'yummies/utils/types';

import { EndpointQueryClient } from './endpoint-query-client.js';
import {
  EndpointQueryMeta,
  EndpointQueryOptions,
  EndpointQueryUnitKey,
} from './endpoint-query.types.js';
import { AnyEndpoint } from './endpoint.types.js';
import { RequestParams } from './http-client.js';

export class EndpointQuery<
  TEndpoint extends AnyEndpoint,
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
> extends Query<TQueryFnData, TError, TData, TQueryData> {
  response: TEndpoint['__response_type'] | null = null;

  constructor(
    private endpoint: AnyEndpoint,
    queryClient: EndpointQueryClient,
    {
      input: getInput,
      uniqKey,
      ...queryOptions
    }: EndpointQueryOptions<TEndpoint, TQueryFnData, TError, TData, TQueryData>,
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
        endpointId: endpoint.endpointId,
        endpointQuery: true,
      } satisfies EndpointQueryMeta,
      options: (query): any => {
        const willEnableManually = queryOptions.enabled === false;
        const input = (getInput?.() || {}) as any;
        const builtOptions = buildOptionsFromInput(endpoint, input, uniqKey);
        // const dynamicOuterOptions = getDynamicOptions?.(query);

        let isEnabled = false;

        if (willEnableManually) {
          // if (dynamicOuterOptions?.enabled != null) {
          //   isEnabled = dynamicOuterOptions.enabled;
          // }
        } else {
          // const outerDynamicEnabled =
          //   dynamicOuterOptions?.enabled == null ||
          //   !!dynamicOuterOptions.enabled;

          // isEnabled = builtOptions.enabled && outerDynamicEnabled;
          isEnabled = builtOptions.enabled;
        }

        return {
          ...query.options,
          ...builtOptions,
          // ...dynamicOuterOptions,
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
          this.response = response as TEndpoint['__response_type'];
        });

        const output = response.data as any;

        return output;
      },
    });

    observable.ref(this, 'response');
    makeObservable(this);
  }

  async start(
    input: MaybeFalsy<TEndpoint['__input_type']>,
  ): Promise<QueryObserverResult<TData, TError>> {
    return await super.start(buildOptionsFromInput(this.endpoint, input));
  }

  protected getInputFromContext(ctx: QueryFunctionContext<any, any>) {
    return (ctx.queryKey.at(-2) || {}) as TEndpoint['__input_type'];
  }
}

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
    queryKey: hasRequiredParams
      ? endpoint.getQueryKey(input || {}, uniqKey)
      : (skipToken as unknown as any[]),
  };
};
