/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  DefaultError,
  QueryFunctionContext,
  QueryObserverResult,
} from '@tanstack/query-core';
import { makeObservable, observable, runInAction } from 'mobx';
import { Query, QueryUpdateOptionsAllVariants } from 'mobx-tanstack-query';
import { AnyObject, Maybe, MaybeFalsy } from 'yummies/utils/types';

import { EndpointQueryClient } from './endpoint-query-client.js';
import {
  EndpointQueryFlattenOptions,
  EndpointQueryMeta,
  EndpointQueryOptions,
  EndpointQueryUniqKey,
  ExcludedQueryKeys,
} from './endpoint-query.types.js';
import { AnyEndpoint } from './endpoint.types.js';
import { RequestParams } from './http-client.js';

export class EndpointQuery<
  TEndpoint extends AnyEndpoint,
  TQueryFnData = TEndpoint['__response']['data'],
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
> extends Query<TQueryFnData, TError, TData, TQueryData> {
  response: TEndpoint['__response'] | null = null;
  params: TEndpoint['__params'] | null = null;

  private uniqKey?: EndpointQueryUniqKey;

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
    QueryUpdateOptionsAllVariants<TQueryFnData, TError, TData, TQueryData>,
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
  ): Promise<QueryObserverResult<TData, TError>> {
    return await super.start(
      buildOptionsFromParams(this.endpoint, params, this.uniqKey),
    );
  }
}

const createEndpointQueryMeta = (endpoint: AnyEndpoint, meta?: AnyObject) =>
  ({
    ...meta,
    tags: endpoint.tags,
    operationId: endpoint.operationId,
    path: endpoint.path,
    pathDeclaration: endpoint.path.join('/'),
    endpointId: endpoint.endpointId,
    endpointQuery: true,
  }) satisfies EndpointQueryMeta;

const getParamsFromContext = (ctx: QueryFunctionContext<any, any>) => {
  return (ctx.queryKey.at(-2) || {}) as AnyEndpoint['__params'];
};

const buildOptionsFromParams = (
  endpoint: AnyEndpoint,
  params: MaybeFalsy<AnyObject>,
  uniqKey: Maybe<EndpointQueryUniqKey>,
) => {
  const { requiredParams } = endpoint.configuration;
  let hasRequiredParams = false;

  if (requiredParams.length > 0) {
    hasRequiredParams =
      !!params && requiredParams.every((param) => param in params);
  } else {
    hasRequiredParams = true;
  }

  return {
    enabled: hasRequiredParams,
    queryKey: endpoint.getQueryKey(params || {}, uniqKey),
  };
};
