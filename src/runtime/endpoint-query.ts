/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  DefaultError,
  QueryFunctionContext,
  QueryObserverResult,
} from '@tanstack/query-core';
import {
  action,
  comparer,
  computed,
  makeObservable,
  observable,
  reaction,
  runInAction,
} from 'mobx';
import { Query, QueryUpdateOptionsAllVariants } from 'mobx-tanstack-query';
import { AnyObject, Maybe, MaybeFalsy } from 'yummies/utils/types';

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
  dynamicOptions?: any;
}

export class EndpointQuery<
  TEndpoint extends AnyEndpoint,
  TQueryFnData = TEndpoint['__response']['data'],
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
> extends Query<TQueryFnData, TError, TData, TQueryData> {
  response: TEndpoint['__response'] | null = null;

  private uniqKey?: EndpointQueryUniqKey;

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
    const {
      uniqKey,
      transform: transformResponse,
      ...queryOptions
    } = typeof queryOptionsInput === 'function'
      ? queryOptionsInput()
      : queryOptionsInput;

    const _observableData: InternalObservableData<TEndpoint> = {
      params: null as MaybeFalsy<TEndpoint['__params']>,
      dynamicOptions: undefined,
    };

    makeObservable(_observableData, {
      params: observable.ref,
      dynamicOptions: observable,
    });

    const disposeFn = reaction(
      (): InternalObservableData<TEndpoint> => {
        if (typeof queryOptionsInput === 'function') {
          const {
            params,
            abortSignal,
            select,
            onDone,
            onError,
            onInit,
            enableOnDemand,
            ...dynamicOptions
          } = queryOptionsInput();
          return {
            params,
            dynamicOptions:
              Object.keys(dynamicOptions).length > 0
                ? dynamicOptions
                : undefined,
          };
        } else {
          return {
            params:
              typeof queryOptionsInput.params === 'function'
                ? queryOptionsInput.params()
                : (queryOptionsInput.params ?? {}),
            dynamicOptions: undefined,
          };
        }
      },
      action(({ params, dynamicOptions }) => {
        _observableData.params = params;
        _observableData.dynamicOptions = dynamicOptions;
      }),
      {
        fireImmediately: true,
      },
    );

    super({
      ...queryOptions,
      queryClient,
      meta: endpoint.toQueryMeta(queryOptions.meta),
      options: (query): any => {
        const builtOptions = buildOptionsFromParams(
          endpoint,
          _observableData.params,
          uniqKey,
        );

        let isEnabled = builtOptions.enabled;

        if (
          typeof queryOptionsInput !== 'function' &&
          queryOptionsInput.enabled === false
        ) {
          isEnabled = false;
        }

        return {
          ...query.options,
          ...builtOptions,
          enabled: isEnabled,
          ..._observableData.dynamicOptions,
        } as any;
      },
      queryFn: async (ctx): Promise<any> => {
        const params = getParamsFromContext(ctx as any);

        runInAction(() => {
          this.response = null;
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
          this.response = response as TEndpoint['__response'];
        });

        return (await transformResponse?.(response)) ?? response.data;
      },
    });

    this.uniqKey = uniqKey;

    observable.ref(this, 'response');
    computed.struct(this, 'params');
    makeObservable(this);

    this._observableData = _observableData;

    this.abortController.signal.addEventListener('abort', disposeFn);
  }

  get params() {
    return this._observableData.params;
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
        ...buildOptionsFromParams(this.endpoint, params, this.uniqKey),
        ...options,
      });
    } else {
      return super.update({
        ...buildOptionsFromParams(
          this.endpoint,
          this._observableData.params,
          this.uniqKey,
        ),
        ...updateParams,
      });
    }
  }

  async start(
    params: MaybeFalsy<TEndpoint['__params']>,
  ): Promise<QueryObserverResult<TData, TError>> {
    runInAction(() => {
      this._observableData.params = params;
    });
    return await super.start(
      buildOptionsFromParams(this.endpoint, params, this.uniqKey),
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
