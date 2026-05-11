/** biome-ignore-all lint/correctness/noUnusedVariables: generic type imports are intentional */
import type {
  DefaultError,
  InfiniteData,
  InfiniteQueryObserverResult,
} from '@tanstack/query-core';
import {
  comparer,
  computed,
  makeObservable,
  observable,
  runInAction,
} from 'mobx';
import {
  InfiniteQuery,
  type InfiniteQueryUpdateOptionsAllVariants,
} from 'mobx-tanstack-query';
import { typeGuard } from 'yummies/type-guard';
import type { AnyObject, Maybe, MaybeFalsy } from 'yummies/types';
import type { AnyEndpoint } from './endpoint.types.js';
import type {
  EndpointInfiniteQueryFlattenOptions,
  EndpointInfiniteQueryMergePageParam,
  EndpointInfiniteQueryOptions,
} from './endpoint-infinite-query.types.js';
import type { EndpointQueryClient } from './endpoint-query-client.js';
import type { RequestParams } from './http-client.js';
import {
  createInternalQueryState,
  type InternalQueryState,
} from './utils/internal-query-state.js';

/**
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoint-queries/)
 */
export class EndpointInfiniteQuery<
  TEndpoint extends AnyEndpoint,
  TQueryFnData = TEndpoint['__response']['data'],
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
> extends InfiniteQuery<TQueryFnData, TError, TPageParam, TData, any[]> {
  private _internal!: InternalQueryState;
  response: TEndpoint['__response'] | null = null;

  /**
   * Creates `EndpointInfiniteQuery` instance.
   */
  constructor(
    endpoint: AnyEndpoint,
    endpointQueryClient: EndpointQueryClient,
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
    const internal = createInternalQueryState(endpoint, {
      isInfinite: true,
      endpointQueryClient,
      // @ts-expect-error
      queryOptionsInput,
    });

    super({
      ...internal.initialQueryParams,
      queryFn: async (ctx): Promise<any> => {
        const params = endpoint.getParamsFromContext(ctx);

        runInAction(() => {
          internal.query.response = null;
          if (!comparer.structural(params, internal.params)) {
            internal.params = params;
          }
        });

        const mergedParams = mergeInfiniteQueryPageParam(
          params,
          (ctx.pageParam as TPageParam) ??
            internal.initialQueryParams.initialPageParam,
          ctx,
          internal.mergePageParam,
        );

        let requestParams = mergedParams.requestParams as Maybe<RequestParams>;

        if (requestParams) {
          if (!requestParams.signal) {
            requestParams.signal = ctx.signal;
          }
        } else {
          requestParams = { signal: ctx.signal };
        }

        const fixedInput = {
          ...mergedParams,
          requestParams,
        };

        const response = await endpoint.request(fixedInput);

        runInAction(() => {
          internal.query.response = response as TEndpoint['__response'];
        });

        if (internal.transformResponse) {
          return await internal.transformResponse(response);
        }
        return response.data;
      },
    });

    // @ts-expect-error
    internal.query = this;

    this._internal = internal;

    computed.struct(this, 'params');
    observable.ref(this, 'response');
    makeObservable(this);
  }

  /**
   * Current base endpoint params used for `queryKey`.
   */
  get params() {
    return this._internal.params;
  }

  /**
   * Updates query options and optionally base params.
   */
  update(
    updateParams: Omit<
      InfiniteQueryUpdateOptionsAllVariants<
        TQueryFnData,
        TError,
        TPageParam,
        TData,
        any[]
      >,
      'queryKey'
    > & {
      params?: MaybeFalsy<TEndpoint['__params']>;
    },
  ) {
    if (!this._internal?.endpoint) {
      return super.update(updateParams as any);
    }

    if ('params' in updateParams) {
      const { params, ...options } = updateParams;
      this._internal.setParamsImperative(params);
      return super.update({
        ...(this._internal.buildOptions(params) as any),
        ...options,
      });
    }
    return super.update({
      ...(this._internal.buildOptions(this._internal.params) as any),
      ...updateParams,
    });
  }

  /**
   * Sets base params and starts the infinite query execution.
   */
  async start(
    params: MaybeFalsy<TEndpoint['__params']>,
  ): Promise<InfiniteQueryObserverResult<TData, TError>> {
    if (!this._internal?.endpoint) {
      return this.queryObserver.getCurrentResult();
    }

    this._internal.setParamsImperative(params);

    return await super.start(this._internal.buildOptions(params) as any);
  }

  protected handleDestroy(): void {
    super.handleDestroy();
    this._internal.reset();
    runInAction(() => {
      this.response = null;
    });
  }
}

function ensureObjectPageParam(
  pageParam: unknown,
  mergePageParam: 'params' | 'body' | 'query' | 'headers',
): AnyObject {
  if (typeGuard.isObject(pageParam)) {
    return pageParam as AnyObject;
  }

  if (process.env.NODE_ENV !== 'production') {
    throw new Error(
      `[mobx-tanstack-query-api] "${mergePageParam}" mergePageParam expects an object pageParam. Use a custom mergePageParam function for primitive page params.`,
    );
  }
  throw new Error('[mobx-tanstack-query-api] minified error #1');
}

export function mergeInfiniteQueryPageParam<
  TEndpoint extends AnyEndpoint,
  TPageParam,
>(
  params: TEndpoint['__params'] & AnyObject,
  pageParam: TPageParam | undefined,
  ctx: any,
  mergePageParam?: EndpointInfiniteQueryMergePageParam<TEndpoint, TPageParam>,
): AnyObject {
  if (pageParam == null || !mergePageParam) {
    return params;
  }

  if (typeof mergePageParam === 'function') {
    return mergePageParam(params, pageParam, ctx) || {};
  }

  const objectPageParam = ensureObjectPageParam(pageParam, mergePageParam);

  switch (mergePageParam) {
    case 'params':
      return {
        ...params,
        ...objectPageParam,
      };
    case 'body':
      return {
        ...params,
        body: {
          ...params.body,
          ...objectPageParam,
        },
      };
    case 'query':
      return {
        ...params,
        query: {
          ...params.query,
          ...objectPageParam,
        },
      };
    case 'headers':
      return {
        ...params,
        headers: {
          ...params.headers,
          ...objectPageParam,
        },
      };
  }
}
