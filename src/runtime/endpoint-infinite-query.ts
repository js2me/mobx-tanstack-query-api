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
import { callFunction } from 'yummies/common';
import { hasEnumerableKeys } from 'yummies/data';
import { typeGuard } from 'yummies/type-guard';
import type { AnyObject, Maybe, MaybeFalsy } from 'yummies/types';
import type { AnyEndpoint } from './endpoint.types.js';
import type {
  EndpointInfiniteQueryFlattenOptions,
  EndpointInfiniteQueryMergePageParam,
  EndpointInfiniteQueryOptions,
} from './endpoint-infinite-query.types.js';
import type { EndpointQueryInternalSync } from './endpoint-query.js';
import type { EndpointQueryUniqKey } from './endpoint-query.types.js';
import type { EndpointQueryClient } from './endpoint-query-client.js';
import type { RequestParams } from './http-client.js';

export interface InfiniteEndpointQueryInternalSync<
  TEndpoint extends AnyEndpoint,
  TPageParam,
> extends EndpointQueryInternalSync<TEndpoint> {
  mergePageParam?: EndpointInfiniteQueryMergePageParam<TEndpoint, TPageParam>;
}

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
  private _sync!: InfiniteEndpointQueryInternalSync<TEndpoint, TPageParam>;
  private _endpoint!: AnyEndpoint;
  response: TEndpoint['__response'] | null = null;

  /**
   * Creates `EndpointInfiniteQuery` instance.
   */
  constructor(
    endpoint: AnyEndpoint,
    inputQueryClient: EndpointQueryClient,
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
    const isQueryOptionsInputFn = typeof queryOptionsInput === 'function';
    const unpackedQueryOptionsInput = isQueryOptionsInputFn
      ? queryOptionsInput()
      : queryOptionsInput;

    const {
      uniqKey,
      transform: transformResponse,
      params,
      onDone: onDoneInput,
      queryClient: overridedQueryClient,
      mergePageParam,
      ...queryOptions
    } = unpackedQueryOptionsInput;

    const queryClient = overridedQueryClient ?? inputQueryClient;

    const sync: InfiniteEndpointQueryInternalSync<TEndpoint, TPageParam> = {
      params: null,
      uniqKey: unpackedQueryOptionsInput.uniqKey,
      mergePageParam,
    };

    makeObservable(sync, {
      params: observable.ref,
      uniqKey: observable.ref,
      mergePageParam: observable.ref,
    });

    const onDone = onDoneInput as any;

    let self!: EndpointInfiniteQuery<
      TEndpoint,
      TQueryFnData,
      TError,
      TPageParam,
      TData
    >;

    super({
      ...queryOptions,
      onDone,
      queryClient,
      meta: endpoint.toQueryMeta(queryOptions.meta),
      options: (query): any => {
        self = query as any;

        let resolvedParams: MaybeFalsy<TEndpoint['__params']>;
        let resolvedUniqKey: Maybe<EndpointQueryUniqKey>;
        let resolvedMergePageParam: InfiniteEndpointQueryInternalSync<
          TEndpoint,
          TPageParam
        >['mergePageParam'];
        let dynamicOptions: any;

        if (isQueryOptionsInputFn) {
          // Reuse the already evaluated constructor options on the first pass.
          // This prevents an extra queryOptionsInput()/params invocation at creation time.
          const result = self._result
            ? queryOptionsInput()
            : unpackedQueryOptionsInput;
          const {
            params: p,
            abortSignal,
            select,
            onDone,
            onError,
            onInit,
            enableOnDemand,
            meta,
            uniqKey: uk,
            transform,
            mergePageParam,
            queryClient,
            ...rest
          } = result;
          resolvedUniqKey = uk;
          resolvedMergePageParam = mergePageParam;
          resolvedParams = 'params' in result ? callFunction(p) : {};
          dynamicOptions = hasEnumerableKeys(rest) ? rest : undefined;
        } else if ('params' in unpackedQueryOptionsInput) {
          const p = unpackedQueryOptionsInput.params;
          resolvedParams = typeof p === 'function' ? callFunction(p) : p;
          resolvedUniqKey = unpackedQueryOptionsInput.uniqKey;
          resolvedMergePageParam = unpackedQueryOptionsInput.mergePageParam;
        } else {
          resolvedParams = {};
          resolvedUniqKey = unpackedQueryOptionsInput.uniqKey;
          resolvedMergePageParam = unpackedQueryOptionsInput.mergePageParam;
        }

        runInAction(() => {
          if (!comparer.structural(sync.params, resolvedParams)) {
            sync.params = resolvedParams;
          }
          if (!comparer.structural(sync.uniqKey, resolvedUniqKey)) {
            sync.uniqKey = resolvedUniqKey;
          }
          if (
            !comparer.structural(sync.mergePageParam, resolvedMergePageParam)
          ) {
            sync.mergePageParam = resolvedMergePageParam;
          }
        });

        const builtOptions = buildInfiniteOptionsFromParams(
          endpoint,
          resolvedParams,
          resolvedUniqKey,
        );

        let isEnabled = builtOptions.enabled;

        if (
          typeof queryOptionsInput !== 'function' &&
          queryOptionsInput.enabled === false
        ) {
          isEnabled = false;
        }

        return {
          ...builtOptions,
          enabled: isEnabled,
          ...dynamicOptions,
        };
      },
      queryFn: async (ctx): Promise<any> => {
        const params = endpoint.getParamsFromContext(ctx);

        runInAction(() => {
          self.response = null;
          if (!comparer.structural(params, sync.params)) {
            sync.params = params;
          }
        });

        const mergedParams = mergeInfiniteQueryPageParam(
          params,
          (ctx.pageParam as TPageParam) ?? queryOptions.initialPageParam,
          ctx,
          sync.mergePageParam,
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
          self.response = response as TEndpoint['__response'];
        });

        if (transformResponse) {
          return await transformResponse(response);
        }
        return response.data;
      },
    });

    self = this;
    this._sync = sync;
    this._endpoint = endpoint;

    computed.struct(this, 'params');
    observable.ref(this, 'response');
    makeObservable(this);
  }

  /**
   * Current base endpoint params used for `queryKey`.
   */
  get params() {
    return this._sync.params;
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
    if (!this._endpoint) {
      return super.update(updateParams as any);
    }

    if ('params' in updateParams) {
      const { params, ...options } = updateParams;
      runInAction(() => {
        this._sync.params = params;
      });
      return super.update({
        ...buildInfiniteOptionsFromParams(
          this._endpoint,
          params,
          this._sync.uniqKey,
        ),
        ...options,
      } as any);
    }

    return super.update({
      ...buildInfiniteOptionsFromParams(
        this._endpoint,
        this._sync.params,
        this._sync.uniqKey,
      ),
      ...updateParams,
    } as any);
  }

  /**
   * Sets base params and starts the infinite query execution.
   */
  async start(
    params: MaybeFalsy<TEndpoint['__params']>,
  ): Promise<InfiniteQueryObserverResult<TData, TError>> {
    if (!this._endpoint) {
      return this.queryObserver.getCurrentResult();
    }

    runInAction(() => {
      this._sync.params = params;
    });
    return await super.start(
      buildInfiniteOptionsFromParams(
        this._endpoint,
        params,
        this._sync.uniqKey,
      ),
    );
  }

  protected handleDestroy(): void {
    super.handleDestroy();
    runInAction(() => {
      this._sync.params = undefined;
      this.response = null;
      this._sync.uniqKey = undefined;
      this._sync.mergePageParam = undefined;
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

export const buildInfiniteOptionsFromParams = (
  endpoint: AnyEndpoint,
  params: MaybeFalsy<AnyObject>,
  uniqKey: Maybe<EndpointQueryUniqKey>,
): { enabled: boolean; queryKey: any[] } => {
  const { requiredParams } = endpoint.configuration;
  let hasRequiredParams = false;

  if (requiredParams.length > 0) {
    hasRequiredParams =
      !!params && requiredParams.every((param) => param in params);
  } else {
    hasRequiredParams = !!params;
  }

  return {
    enabled: hasRequiredParams,
    queryKey: endpoint.toInfiniteQueryKey(params || {}, uniqKey),
  };
};
