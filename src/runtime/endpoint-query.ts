/** biome-ignore-all lint/correctness/noUnusedVariables: generic type imports are intentional */
import type {
  DefaultError,
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
import type { Maybe, MaybeFalsy } from 'yummies/types';
import type { AnyEndpoint } from './endpoint.types.js';
import type {
  EndpointQueryFlattenOptions,
  EndpointQueryOptions,
  ExcludedQueryKeys,
} from './endpoint-query.types.js';
import type { EndpointQueryClient } from './endpoint-query-client.js';
import type { RequestParams } from './http-client.js';
import {
  createInternalQueryState,
  type InternalQueryState,
} from './utils/internal-query-state.js';

export type EndpointQueryInternalSync<TEndpoint extends AnyEndpoint> = Pick<
  InternalQueryState<TEndpoint['__params']>,
  'params' | 'uniqKey'
>;

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
  private _internal!: InternalQueryState<TEndpoint['__params']>;
  response: TEndpoint['__response'] | null = null;

  /**
   * Creates `EndpointQuery` instance.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoint-queries/#constructor)
   */
  constructor(
    endpoint: AnyEndpoint,
    endpointQueryClient: EndpointQueryClient,
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
    const internal = createInternalQueryState(endpoint, {
      endpointQueryClient,
      // @ts-expect-error
      queryOptionsInput,
    });

    super({
      ...internal.initialQueryParams,
      queryFn: async (ctx): Promise<any> => {
        const params = internal.endpoint.getParamsFromContext(ctx);

        runInAction(() => {
          internal.query.response = null;
          if (!comparer.structural(params, internal.params)) {
            internal.params = params;
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

        const response = await internal.endpoint.request(fixedInput);

        runInAction(() => {
          internal.query.response = response;
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
   * Current endpoint params used by this query.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoint-queries/#params)
   */
  get params() {
    return this._internal.params;
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
    if (!this._internal?.endpoint) {
      return super.update(updateParams as any);
    }

    if ('params' in updateParams) {
      const { params, ...options } = updateParams;
      this._internal.setParamsImperative(params);
      return super.update({
        ...this._internal.buildOptions(params),
        ...options,
      });
    }
    return super.update({
      ...this._internal.buildOptions(this._internal.params),
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
    if (!this._internal?.endpoint) {
      return this.queryObserver.getCurrentResult();
    }

    this._internal.setParamsImperative(params);

    return await super.start(this._internal.buildOptions(params));
  }

  protected handleDestroy(): void {
    super.handleDestroy();
    this._internal.reset();
    runInAction(() => {
      this.response = null;
    });
  }
}
