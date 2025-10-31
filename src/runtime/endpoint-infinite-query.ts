import type {
  DefaultError,
  InfiniteData,
  QueryObserverResult,
} from '@tanstack/query-core';
import { makeObservable, observable, runInAction } from 'mobx';
import { InfiniteQuery } from 'mobx-tanstack-query';
import type { Maybe, MaybeFalsy } from 'yummies/types';
import type { AnyEndpoint } from './endpoint.types.js';
import type {
  EndpointInfiniteQueryFlattenOptions,
  EndpointInfiniteQueryOptions,
  EndpointInfiniteQueryUpdateOptionsAllVariants,
} from './endpoint-infinite-query.types.js';
import { buildOptionsFromParams } from './endpoint-query.js';
import type { EndpointQueryUniqKey } from './endpoint-query.types.js';
import type { EndpointQueryClient } from './endpoint-query-client.js';
import type { RequestParams } from './http-client.js';

export class EndpointInfiniteQuery<
  TEndpoint extends AnyEndpoint,
  TQueryFnData = TEndpoint['__response']['data'],
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
> extends InfiniteQuery<TQueryFnData, TError, TPageParam, TData, any[]> {
  response: TEndpoint['__response'] | null = null;
  params: TEndpoint['__params'] | null = null;

  private uniqKey?: EndpointQueryUniqKey;

  private paramsFn: EndpointInfiniteQueryFlattenOptions<
    TEndpoint,
    TQueryFnData,
    TError,
    TPageParam,
    TData
  >['params'];

  constructor(
    private endpoint: AnyEndpoint,
    queryClient: EndpointQueryClient,

    queryOptionsInput:
      | EndpointInfiniteQueryOptions<
          TEndpoint,
          TQueryFnData,
          TError,
          TPageParam,
          TData
        >
      | (() => EndpointInfiniteQueryFlattenOptions<
          TEndpoint,
          TQueryFnData,
          TError,
          TPageParam,
          TData
        >),
  ) {
    const {
      uniqKey,
      transform: transformResponse,
      params: paramsFn,
      ...queryOptions
    } = typeof queryOptionsInput === 'function'
      ? queryOptionsInput()
      : queryOptionsInput;

    super({
      ...queryOptions,
      queryClient,
      meta: endpoint.toQueryMeta(queryOptions.meta),
      options: (query): any => {
        const extraOptions: any = {};
        let willEnableManually: boolean;
        let params: any;

        const pageParam = query.options.initialPageParam;

        if (typeof queryOptionsInput === 'function') {
          Object.assign(extraOptions, queryOptionsInput());
          params = paramsFn(pageParam);
          willEnableManually = false;
        } else {
          willEnableManually = queryOptionsInput.enabled === false;
          params = paramsFn(pageParam);
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
        const params = paramsFn(
          (ctx.pageParam as any) ?? queryOptions.initialPageParam,
        ) as TEndpoint['__params'];

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

    this.paramsFn = paramsFn;
    this.uniqKey = uniqKey;

    observable.ref(this, 'response');
    observable.ref(this, 'params');
    makeObservable(this);
  }

  update({
    params,
    ...options
  }: EndpointInfiniteQueryUpdateOptionsAllVariants<
    TEndpoint,
    TQueryFnData,
    TError,
    TPageParam,
    TData
  >) {
    return super.update({
      ...buildOptionsFromParams(this.endpoint, params, this.uniqKey),
      ...options,
    });
  }

  async start(
    params: MaybeFalsy<TEndpoint['__params']>,
  ): Promise<QueryObserverResult<TData, TError>> {
    return await super.start(
      buildOptionsFromParams(this.endpoint, params, this.uniqKey),
    );
  }
}
