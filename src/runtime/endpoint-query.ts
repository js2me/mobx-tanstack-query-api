/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  DefaultError,
  QueryFunctionContext,
  QueryObserverResult,
} from '@tanstack/query-core';
import {
  comparer,
  computed,
  makeObservable,
  observable,
  reaction,
  runInAction,
} from 'mobx';
import { Query, QueryUpdateOptionsAllVariants } from 'mobx-tanstack-query';
import { callFunction } from 'yummies/common';
import { getMobxAdministration, lazyObserve } from 'yummies/mobx';
import { AnyObject, Maybe, MaybeFalsy, MaybeFn } from 'yummies/utils/types';

import { EndpointQueryClient } from './endpoint-query-client.js';
import {
  EndpointQueryFlattenOptions,
  EndpointQueryOptions,
  EndpointQueryUniqKey,
  ExcludedQueryKeys,
} from './endpoint-query.types.js';
import { AnyEndpoint } from './endpoint.types.js';
import { RequestParams } from './http-client.js';

interface InternalObservableData<TEndpoint extends AnyEndpoint> {
  params: MaybeFalsy<TEndpoint['__params']>;
  uniqKey?: EndpointQueryUniqKey;
  initialized?: boolean;
  dynamicOptions?: any;
  response: TEndpoint['__response'] | null;
}

export class EndpointQuery<
  TEndpoint extends AnyEndpoint,
  TQueryFnData = TEndpoint['__response']['data'],
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
> extends Query<TQueryFnData, TError, TData, TQueryData> {
  private _observableData: InternalObservableData<TEndpoint>;

  constructor(
    private endpoint: AnyEndpoint,
    queryClient: EndpointQueryClient,
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
      ...queryOptions
    } = unpackedQueryOptionsInput;

    const _observableData: InternalObservableData<TEndpoint> = {
      params: null,
      dynamicOptions: undefined,
      response: null,
      uniqKey: unpackedQueryOptionsInput.uniqKey,
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
    });

    super({
      ...queryOptions,
      queryClient,
      meta: endpoint.toQueryMeta(queryOptions.meta),
      options: (query): any => {
        const builtOptions = buildOptionsFromParams(
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
        const params = getParamsFromContext(ctx as any);

        runInAction(() => {
          _observableData.response = null;
          if (!comparer.structural(params, _observableData.params)) {
            _observableData.params = params;
          }
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
          _observableData.response = response as TEndpoint['__response'];
        });

        return (await transformResponse?.(response)) ?? response.data;
      },
    });

    const parentAtom = getMobxAdministration(this);

    computed.struct(this, 'params');
    computed.struct(this, 'response');
    makeObservable(this);

    if (isQueryOptionsInputFn || typeof params === 'function') {
      const createParamsReaction = () =>
        reaction(
          (): Partial<InternalObservableData<TEndpoint>> => {
            let outDynamicOptions: InternalObservableData<TEndpoint>['dynamicOptions'];
            let outParams: MaybeFn<MaybeFalsy<TEndpoint['__params']>>;
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
                ...dynamicOptions
              } = result;

              uniqKey = _uniqKey;

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
            } else {
              outParams = {};
              uniqKey = unpackedQueryOptionsInput.uniqKey;
            }

            return {
              params: callFunction(outParams),
              dynamicOptions: outDynamicOptions,
              uniqKey,
            };
          },
          ({ params, dynamicOptions, uniqKey }) => {
            runInAction(() => {
              _observableData.initialized = true;
              _observableData.params = params;
              _observableData.dynamicOptions = dynamicOptions;
              _observableData.uniqKey = uniqKey;
            });
          },
          {
            fireImmediately: true,
          },
        );

      if (this.isLazy) {
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

  get params() {
    return this._observableData.params;
  }

  get response() {
    return this._observableData.response;
  }

  update(
    updateParams: Omit<
      QueryUpdateOptionsAllVariants<TQueryFnData, TError, TData, TQueryData>,
      ExcludedQueryKeys
    > & {
      params?: MaybeFalsy<TEndpoint['__params']>;
    },
  ) {
    if ('params' in updateParams) {
      const { params, ...options } = updateParams;
      runInAction(() => {
        this._observableData.params = params;
      });
      return super.update({
        ...buildOptionsFromParams(
          this.endpoint,
          params,
          this._observableData.uniqKey,
        ),
        ...options,
      });
    } else if (this._observableData) {
      return super.update({
        ...buildOptionsFromParams(
          this.endpoint,
          this._observableData.params,
          this._observableData.uniqKey,
        ),
        ...updateParams,
      });
    } else {
      return super.update(updateParams);
    }
  }

  async start(
    params: MaybeFalsy<TEndpoint['__params']>,
  ): Promise<QueryObserverResult<TData, TError>> {
    runInAction(() => {
      this._observableData.params = params;
    });
    return await super.start(
      buildOptionsFromParams(
        this.endpoint,
        params,
        this._observableData.uniqKey,
      ),
    );
  }

  destroy(): void {
    super.destroy();
    runInAction(() => {
      this._observableData.params = undefined;
      this._observableData.dynamicOptions = undefined;
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
