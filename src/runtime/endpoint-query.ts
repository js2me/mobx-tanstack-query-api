/** biome-ignore-all lint/correctness/noUnusedVariables: generic type imports are intentional */
import type {
  DefaultError,
  QueryFunctionContext,
  QueryObserverResult,
  RefetchOptions,
} from '@tanstack/query-core';
import {
  comparer,
  computed,
  makeObservable,
  observable,
  runInAction,
} from 'mobx';
import { Query, type QueryUpdateOptionsAllVariants } from 'mobx-tanstack-query';
import { callFunction } from 'yummies/common';
import { hasEnumerableKeys } from 'yummies/data';
import type { AnyObject, Maybe, MaybeFalsy } from 'yummies/types';
import type { AnyEndpoint } from './endpoint.types.js';
import type {
  EndpointQueryFlattenOptions,
  EndpointQueryOptions,
  EndpointQueryUniqKey,
  ExcludedQueryKeys,
} from './endpoint-query.types.js';
import type { EndpointQueryClient } from './endpoint-query-client.js';
import type { RequestParams } from './http-client.js';

interface EndpointQuerySync<TEndpoint extends AnyEndpoint> {
  params: MaybeFalsy<TEndpoint['__params']>;
  uniqKey?: EndpointQueryUniqKey;
}

/**
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoint-queries/)
 */
export class EndpointQuery<
  TEndpoint extends AnyEndpoint,
  TQueryFnData = TEndpoint['__response']['data'],
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
> extends Query<TQueryFnData, TError, TData, TQueryData> {
  private _sync!: EndpointQuerySync<TEndpoint>;
  private _endpoint!: AnyEndpoint;
  response: TEndpoint['__response'] | null = null;

  /**
   * Creates `EndpointQuery` instance.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoint-queries/#constructor)
   */
  constructor(
    endpoint: AnyEndpoint,
    inputQueryClient: EndpointQueryClient,
    queryOptionsInput:
      | EndpointQueryOptions<TEndpoint, TQueryFnData, TError, TData, TQueryData>
      | (() => EndpointQueryFlattenOptions<
          TEndpoint,
          TQueryFnData,
          TError,
          TData,
          TQueryData
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
      ...queryOptions
    } = unpackedQueryOptionsInput;

    const queryClient = overridedQueryClient ?? inputQueryClient;

    const sync: EndpointQuerySync<TEndpoint> = {
      params: null,
      uniqKey: unpackedQueryOptionsInput.uniqKey,
    };

    makeObservable(sync, {
      params: observable.ref,
      uniqKey: observable.ref,
    });

    const onDone = onDoneInput as any;

    let self!: EndpointQuery<
      TEndpoint,
      TQueryFnData,
      TError,
      TData,
      TQueryData
    >;

    super({
      ...queryOptions,
      onDone,
      queryClient,
      meta: endpoint.toQueryMeta(queryOptions.meta),
      options: (query): any => {
        self = query as any;

        let resolvedParams: MaybeFalsy<TEndpoint['__params']>;
        let dynamicOptions: any;
        let resolvedUniqKey: Maybe<EndpointQueryUniqKey>;

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
            uniqKey: uk,
            ...rest
          } = result;

          resolvedUniqKey = uk;

          if ('params' in result) {
            resolvedParams = callFunction(params);
          } else {
            resolvedParams = {};
          }

          dynamicOptions = hasEnumerableKeys(rest) ? rest : undefined;
        } else if ('params' in unpackedQueryOptionsInput) {
          const params = unpackedQueryOptionsInput.params;
          resolvedParams = callFunction(params);
          resolvedUniqKey = unpackedQueryOptionsInput.uniqKey;
        } else {
          resolvedParams = {};
          resolvedUniqKey = unpackedQueryOptionsInput.uniqKey;
        }

        runInAction(() => {
          if (!comparer.structural(sync.params, resolvedParams)) {
            sync.params = resolvedParams;
          }
          if (!comparer.structural(sync.uniqKey, resolvedUniqKey)) {
            sync.uniqKey = resolvedUniqKey;
          }
        });

        const builtOptions = buildOptionsFromParams(
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

        let requestParams = params.requestParams as Maybe<RequestParams>;

        if (requestParams) {
          if (!requestParams.signal) {
            requestParams.signal = ctx.signal;
          }
        } else {
          requestParams = { signal: ctx.signal };
        }

        const fixedInput = {
          ...params,
          requestParams,
        };

        const response = await endpoint.request(fixedInput);

        runInAction(() => {
          self.response = response as TEndpoint['__response'];
        });

        return (await transformResponse?.(response)) ?? response.data;
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
   * Current endpoint params used by this query.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoint-queries/#params)
   */
  get params() {
    return this._sync.params;
  }

  /**
   * Updates query options and optionally params.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoint-queries/#update)
   */
  update(
    updateParams: Omit<
      QueryUpdateOptionsAllVariants<TQueryFnData, TError, TData, TQueryData>,
      ExcludedQueryKeys
    > & {
      params?: MaybeFalsy<TEndpoint['__params']>;
    },
  ) {
    if (this._endpoint === undefined) {
      return super.update(updateParams as any);
    }

    if ('params' in updateParams) {
      const { params, ...options } = updateParams;
      runInAction(() => {
        this._sync.params = params;
      });
      return super.update({
        ...buildOptionsFromParams(this._endpoint, params, this._sync.uniqKey),
        ...options,
      });
    }
    return super.update({
      ...buildOptionsFromParams(
        this._endpoint,
        this._sync.params,
        this._sync.uniqKey,
      ),
      ...updateParams,
    });
  }

  /**
   * Refetches query when params are initialized.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoint-queries/#refetch)
   */
  refetch(
    options?: RefetchOptions,
  ): Promise<QueryObserverResult<TData, TError>> {
    if (this.params) {
      return super.refetch(options);
    }
    return Promise.resolve(this.queryObserver.getCurrentResult());
  }

  /**
   * Sets params and starts query execution.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoint-queries/#start)
   */
  async start(
    params: MaybeFalsy<TEndpoint['__params']>,
  ): Promise<QueryObserverResult<TData, TError>> {
    runInAction(() => {
      this._sync.params = params;
    });
    return await super.start(
      buildOptionsFromParams(this._endpoint, params, this._sync.uniqKey),
    );
  }

  protected handleDestroy(): void {
    super.handleDestroy();
    runInAction(() => {
      this._sync.params = undefined;
      this.response = null;
      this._sync.uniqKey = undefined;
    });
  }
}

export const getParamsFromContext = (ctx: QueryFunctionContext<any, any>) => {
  return (ctx.queryKey.at(-2) || {}) as AnyEndpoint['__params'];
};

export const buildOptionsFromParams = (
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
    queryKey: endpoint.toQueryKey(params || {}, uniqKey),
  };
};
