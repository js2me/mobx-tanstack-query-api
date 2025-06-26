import {
  DefaultError,
  InfiniteData,
  QueryKey,
  QueryObserverResult,
} from '@tanstack/query-core';
import { makeObservable, observable, runInAction } from 'mobx';
import {
  InfiniteQuery,
  InfiniteQueryUpdateOptionsAllVariants,
} from 'mobx-tanstack-query';
import { Maybe, MaybeFalsy } from 'yummies/utils/types';

import {
  EndpointInfiniteQueryFlattenOptions,
  EndpointInfiniteQueryOptions,
} from './endpoint-infinite-query.types.js';
import { EndpointQueryClient } from './endpoint-query-client.js';
import {
  buildOptionsFromParams,
  createEndpointQueryMeta,
  getParamsFromContext,
} from './endpoint-query.js';
import {
  EndpointQueryUniqKey,
  ExcludedQueryKeys,
} from './endpoint-query.types.js';
import { AnyEndpoint } from './endpoint.types.js';
import { RequestParams } from './http-client.js';

export class EndpointInfiniteQuery<
  TEndpoint extends AnyEndpoint,
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
  TPageParam = unknown,
> extends InfiniteQuery<TData, TError, TQueryKey, TPageParam> {
  response: TEndpoint['__response'] | null = null;
  params: TEndpoint['__params'] | null = null;

  private uniqKey?: EndpointQueryUniqKey;

  constructor(
    private endpoint: AnyEndpoint,
    queryClient: EndpointQueryClient,

    queryOptionsInput:
      | EndpointInfiniteQueryOptions<
          TEndpoint,
          TData,
          TError,
          TQueryKey,
          TPageParam
        >
      | (() => EndpointInfiniteQueryFlattenOptions<
          TEndpoint,
          TData,
          TError,
          TQueryKey,
          TPageParam
        >),
  ) {
    const {
      uniqKey,
      transform: transformResponse,
      ...queryOptions
    } = typeof queryOptionsInput === 'function'
      ? queryOptionsInput()
      : queryOptionsInput;

    super({
      ...queryOptions,
      queryClient,
      meta: createEndpointQueryMeta(endpoint, queryOptions.meta),
      options: (query): any => {
        const extraOptions: any = {};
        let willEnableManually: boolean;
        let params: any;

        if (typeof queryOptionsInput === 'function') {
          const { params: dynamicParams, ...dynamicOptions } =
            queryOptionsInput();
          Object.assign(extraOptions, dynamicOptions);
          params = dynamicParams;
          willEnableManually = false;
        } else {
          willEnableManually = queryOptions.enabled === false;
          params = (queryOptionsInput.params?.() || {}) as any;
        }

        const builtOptions = buildOptionsFromParams(endpoint, params, uniqKey);
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
          ...extraOptions,
        } as any;
      },
      queryFn: async (ctx): Promise<any> => {
        const params = getParamsFromContext(ctx as any);

        runInAction(() => {
          this.response = null;
          this.params = params;
        });

        let requestParams = params.request as Maybe<RequestParams>;

        if (requestParams) {
          if (!requestParams.signal) {
            requestParams.signal = ctx.signal;
          }
        } else {
          requestParams = { signal: ctx.signal };
        }

        const fixedInput = {
          ...params,
          request: requestParams,
        };

        const response = await endpoint.request(fixedInput);

        runInAction(() => {
          this.response = response as TEndpoint['__response'];
        });

        return (await transformResponse?.(response)) ?? response.data;
      },
    });

    this.uniqKey = uniqKey;

    observable.ref(this, 'response');
    observable.ref(this, 'params');
    makeObservable(this);
  }

  update({
    params,
    ...options
  }: Omit<
    InfiniteQueryUpdateOptionsAllVariants<TData, TError, TQueryKey, TPageParam>,
    ExcludedQueryKeys
  > & {
    params?: MaybeFalsy<TEndpoint['__params']>;
  }) {
    return super.update({
      ...buildOptionsFromParams(this.endpoint, params, this.uniqKey),
      ...options,
    });
  }

  async start(
    params: MaybeFalsy<TEndpoint['__params']>,
  ): Promise<QueryObserverResult<InfiniteData<TData, TPageParam>, TError>> {
    return await super.start(
      buildOptionsFromParams(this.endpoint, params, this.uniqKey),
    );
  }
}
