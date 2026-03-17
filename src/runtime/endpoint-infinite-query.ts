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
  reaction,
  runInAction,
} from 'mobx';
import {
  InfiniteQuery,
  type InfiniteQueryUpdateOptionsAllVariants,
} from 'mobx-tanstack-query';
import { callFunction } from 'yummies/common';
import { getMobxAdministration, lazyObserve } from 'yummies/mobx';
import type { AnyObject, Maybe, MaybeFalsy, MaybeFn } from 'yummies/types';
import type { AnyEndpoint } from './endpoint.types.js';
import type {
  EndpointInfiniteQueryFlattenOptions,
  EndpointInfiniteQueryMergePageParam,
  EndpointInfiniteQueryOptions,
} from './endpoint-infinite-query.types.js';
import type { EndpointQueryUniqKey } from './endpoint-query.types.js';
import type { EndpointQueryClient } from './endpoint-query-client.js';
import type { RequestParams } from './http-client.js';

interface InternalObservableData<
  TEndpoint extends AnyEndpoint,
  TQueryFnData,
  TPageParam,
> {
  params: MaybeFalsy<TEndpoint['__params']>;
  uniqKey?: EndpointQueryUniqKey;
  initialized?: boolean;
  dynamicOptions?: any;
  response: TEndpoint['__response'] | null;
  transform?: (
    response: TEndpoint['__response'],
  ) => TQueryFnData | Promise<TQueryFnData>;
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
  private _observableData: InternalObservableData<
    TEndpoint,
    TQueryFnData,
    TPageParam
  >;

  /**
   * Creates `EndpointInfiniteQuery` instance.
   */
  constructor(
    private endpoint: AnyEndpoint,
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

    const _observableData: InternalObservableData<
      TEndpoint,
      TQueryFnData,
      TPageParam
    > = {
      params: null,
      dynamicOptions: undefined,
      response: null,
      uniqKey: unpackedQueryOptionsInput.uniqKey,
      transform: transformResponse,
      mergePageParam,
    };

    if (!isQueryOptionsInputFn && typeof params !== 'function') {
      if ('params' in unpackedQueryOptionsInput) {
        _observableData.params = params;
      } else {
        _observableData.params = {};
      }
      _observableData.initialized = true;
    }

    makeObservable(_observableData, {
      params: observable.ref,
      response: observable.ref,
      dynamicOptions: observable,
      transform: observable.ref,
      mergePageParam: observable.ref,
    });

    const onDone =
      onDoneInput &&
      ((...args: Parameters<NonNullable<typeof onDoneInput>>) => {
        onDoneInput(...args);
      });

    super({
      ...queryOptions,
      onDone,
      queryClient,
      meta: endpoint.toQueryMeta(queryOptions.meta),
      options: (): any => {
        const builtOptions = buildInfiniteOptionsFromParams(
          endpoint,
          _observableData.params,
          _observableData.uniqKey,
        );

        let isEnabled = !!_observableData.initialized && builtOptions.enabled;

        if (
          typeof queryOptionsInput !== 'function' &&
          queryOptionsInput.enabled === false
        ) {
          isEnabled = false;
        }

        return {
          ...builtOptions,
          enabled: isEnabled,
          ..._observableData.dynamicOptions,
        };
      },
      queryFn: async (ctx): Promise<any> => {
        const params = endpoint.getParamsFromContext(ctx);

        runInAction(() => {
          _observableData.response = null;
          if (!comparer.structural(params, _observableData.params)) {
            _observableData.params = params;
          }
        });

        const mergedParams = mergeInfiniteQueryPageParam(
          params,
          (ctx.pageParam as TPageParam) ?? queryOptions.initialPageParam,
          ctx,
          _observableData.mergePageParam,
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
          _observableData.response = response as TEndpoint['__response'];
        });

        return (await _observableData.transform?.(response)) ?? response.data;
      },
    });

    const parentAtom = getMobxAdministration(this);

    computed.struct(this, 'params');
    computed.struct(this, 'response');
    makeObservable(this);

    if (isQueryOptionsInputFn || typeof params === 'function') {
      const createParamsReaction = () =>
        reaction(
          (): Partial<
            InternalObservableData<TEndpoint, TQueryFnData, TPageParam>
          > => {
            let outDynamicOptions: InternalObservableData<
              TEndpoint,
              TQueryFnData,
              TPageParam
            >['dynamicOptions'];
            let outParams: MaybeFn<MaybeFalsy<TEndpoint['__params']>>;
            let outTransform: InternalObservableData<
              TEndpoint,
              TQueryFnData,
              TPageParam
            >['transform'];
            let outMergePageParam: InternalObservableData<
              TEndpoint,
              TQueryFnData,
              TPageParam
            >['mergePageParam'];
            let uniqKey: Maybe<EndpointQueryUniqKey>;

            if (isQueryOptionsInputFn) {
              const result = queryOptionsInput();
              const {
                params,
                abortSignal,
                select,
                onDone,
                onError,
                onInit,
                enableOnDemand,
                uniqKey: _uniqKey,
                transform,
                mergePageParam,
                queryClient,
                ...dynamicOptions
              } = result;

              uniqKey = _uniqKey;
              outTransform = transform;
              outMergePageParam = mergePageParam;

              if ('params' in result) {
                outParams = result.params;
              } else {
                outParams = {};
              }

              outDynamicOptions =
                Object.keys(dynamicOptions).length > 0
                  ? dynamicOptions
                  : undefined;
            } else if ('params' in unpackedQueryOptionsInput) {
              outParams = unpackedQueryOptionsInput.params;
              uniqKey = unpackedQueryOptionsInput.uniqKey;
              outTransform = unpackedQueryOptionsInput.transform;
              outMergePageParam = unpackedQueryOptionsInput.mergePageParam;
            } else {
              outParams = {};
              uniqKey = unpackedQueryOptionsInput.uniqKey;
              outTransform = unpackedQueryOptionsInput.transform;
              outMergePageParam = unpackedQueryOptionsInput.mergePageParam;
            }

            return {
              params: callFunction(outParams),
              dynamicOptions: outDynamicOptions,
              uniqKey,
              transform: outTransform,
              mergePageParam: outMergePageParam,
            };
          },
          ({ params, dynamicOptions, uniqKey, transform, mergePageParam }) => {
            runInAction(() => {
              _observableData.initialized = true;
              _observableData.params = params;
              _observableData.dynamicOptions = dynamicOptions;
              _observableData.uniqKey = uniqKey;
              _observableData.transform = transform;
              _observableData.mergePageParam = mergePageParam;
            });
          },
          {
            fireImmediately: true,
          },
        );

      if (this.features.lazy) {
        lazyObserve({
          property: parentAtom.values_.get('_result'),
          onStart: createParamsReaction,
          onEnd: (disposeFn) => disposeFn(),
        });
      } else {
        this.abortController.signal.addEventListener(
          'abort',
          createParamsReaction(),
        );
      }
    }

    this._observableData = _observableData;
  }

  /**
   * Current base endpoint params used for `queryKey`.
   */
  get params() {
    return this._observableData.params;
  }

  /**
   * Last raw HTTP response returned by endpoint.
   */
  get response() {
    return this._observableData.response;
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
    if ('params' in updateParams) {
      const { params, ...options } = updateParams;
      if (this._observableData) {
        runInAction(() => {
          this._observableData.params = params;
        });
        return super.update({
          ...buildInfiniteOptionsFromParams(
            this.endpoint,
            params,
            this._observableData.uniqKey,
          ),
          ...options,
        } as any);
      }

      return super.update(options as any);
    }

    if (this._observableData) {
      return super.update({
        ...buildInfiniteOptionsFromParams(
          this.endpoint,
          this._observableData.params,
          this._observableData.uniqKey,
        ),
        ...updateParams,
      } as any);
    }

    return super.update(updateParams as any);
  }

  /**
   * Sets base params and starts the infinite query execution.
   */
  async start(
    params: MaybeFalsy<TEndpoint['__params']>,
  ): Promise<InfiniteQueryObserverResult<TData, TError>> {
    runInAction(() => {
      this._observableData.params = params;
    });
    return await super.start(
      buildInfiniteOptionsFromParams(
        this.endpoint,
        params,
        this._observableData.uniqKey,
      ),
    );
  }

  protected handleDestroy(): void {
    super.handleDestroy();
    runInAction(() => {
      this._observableData.params = undefined;
      this._observableData.dynamicOptions = undefined;
      this._observableData.transform = undefined;
      this._observableData.mergePageParam = undefined;
    });
  }
}

function ensureObjectPageParam(
  pageParam: unknown,
  mergePageParam: 'params' | 'body' | 'query' | 'headers',
): AnyObject {
  if (
    typeof pageParam === 'object' &&
    pageParam !== null &&
    !Array.isArray(pageParam)
  ) {
    return pageParam as AnyObject;
  }

  throw new Error(
    `[mobx-tanstack-query-api] "${mergePageParam}" mergePageParam expects an object pageParam. Use a custom mergePageParam function for primitive page params.`,
  );
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
          ...(params.body as AnyObject),
          ...objectPageParam,
        },
      };
    case 'query':
      return {
        ...params,
        query: {
          ...(params.query as AnyObject),
          ...objectPageParam,
        },
      };
    case 'headers':
      return {
        ...params,
        headers: {
          ...(params.headers as AnyObject),
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
