import {
  action,
  comparer,
  makeObservable,
  observable,
  runInAction,
} from 'mobx';
import type { QueryStartParams } from 'mobx-tanstack-query';
import { callFunction } from 'yummies/common';
import { hasEnumerableKeys } from 'yummies/data';
import type { AnyObject, Maybe, MaybeFalsy } from 'yummies/types';
import type { AnyEndpoint } from '../endpoint.types.js';
import type { EndpointInfiniteQuery } from '../endpoint-infinite-query.js';
import type {
  EndpointInfiniteQueryFlattenOptions,
  EndpointInfiniteQueryMergePageParam,
  EndpointInfiniteQueryOptions,
} from '../endpoint-infinite-query.types.js';
import type { EndpointQuery } from '../endpoint-query.js';
import type { EndpointQueryUniqKey } from '../endpoint-query.types.js';
import type { EndpointQueryClient } from '../endpoint-query-client.js';
import { buildOptionsFromParams } from './build-options-from-params.js';

/**
 * Mutable runtime slice for endpoint-backed queries: synced params, endpoint ref,
 * and bookkeeping so imperative `update`/`start` params are not overwritten by static options.
 */
export interface InternalQueryState<TParams extends AnyObject = AnyObject> {
  query: EndpointQuery<any, any> | EndpointInfiniteQuery<any, any>;
  transformResponse: any;
  initialQueryParams: any;
  isFinite?: boolean;
  buildOptions(
    params: MaybeFalsy<TParams>,
    uniqKey?: any,
  ): QueryStartParams<any, any, any, any>;
  /** Current request params exposed on the query; drives query key when combined with `uniqKey`. */
  params: MaybeFalsy<TParams>;
  /** Optional segment appended to the query key for disambiguation (dedupe, cache isolation). */
  uniqKey?: EndpointQueryUniqKey;
  /** Infinite-query only: cursor merge helper wired from options; unused for finite queries. */
  mergePageParam?: EndpointInfiniteQueryMergePageParam<AnyEndpoint, any>;
  /** Endpoint instance this query belongs to (request, key shape, required params). */
  endpoint: AnyEndpoint;
  setParamsImperative(params: MaybeFalsy<TParams>): void;
  /** Clears params-related override bookkeeping and param fields (e.g. on destroy). */
  reset(): void;
}

export function createInternalQueryState<TParams extends AnyObject>(
  endpoint: AnyEndpoint,
  {
    isFinite,
    endpointQueryClient,
    queryOptionsInput,
  }: {
    isFinite: boolean;
    endpointQueryClient: EndpointQueryClient;
    queryOptionsInput:
      | EndpointInfiniteQueryOptions<any, any>
      | (() => EndpointInfiniteQueryFlattenOptions<any, any>);
  },
): InternalQueryState<TParams> {
  const isQueryOptionsInputFn = typeof queryOptionsInput === 'function';
  const unpackedQueryOptionsInput = isQueryOptionsInputFn
    ? queryOptionsInput()
    : queryOptionsInput;

  const {
    uniqKey,
    transform: transformResponse,
    params,
    onDone,
    queryClient: overridedQueryClient,
    mergePageParam,
    ...queryOptions
  } = unpackedQueryOptionsInput;

  const imperativeCtx = {
    imperativeOverride: false,
    inputParamsSampled: false,
    lastInputResolved: undefined as any,
  };

  const state: InternalQueryState<TParams> = {
    query: null as any,
    transformResponse,
    isFinite,
    params: null,
    uniqKey: unpackedQueryOptionsInput.uniqKey,
    mergePageParam,
    endpoint,
    buildOptions(params, uniqKey) {
      return buildOptionsFromParams(
        this.endpoint,
        params,
        uniqKey ?? this.uniqKey,
        isFinite,
      );
    },
    setParamsImperative(params) {
      imperativeCtx.imperativeOverride = true;
      this.params = params;
    },
    reset() {
      imperativeCtx.imperativeOverride = false;
      imperativeCtx.inputParamsSampled = false;
      imperativeCtx.lastInputResolved = undefined;
      runInAction(() => {
        this.params = undefined;
        this.uniqKey = undefined;
        this.mergePageParam = undefined;
      });
    },
    initialQueryParams: {
      ...queryOptions,
      onDone,
      queryClient: overridedQueryClient ?? endpointQueryClient,
      meta: endpoint.toQueryMeta(queryOptions.meta),
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TanStack `options()` bundles unpack + imperative merge
      options: (queryArg: any) => {
        state.query = queryArg as any;

        let inputResolved: MaybeFalsy<AnyObject>;
        let resolvedUniqKey: Maybe<EndpointQueryUniqKey>;
        let resolvedMergePageParam:
          | EndpointInfiniteQueryMergePageParam<AnyEndpoint, any>
          | undefined;
        let dynamicOptions: any;

        const isMobxQueryInitialized = Boolean(
          (state.query as unknown as { _result?: unknown })._result,
        );

        if (isQueryOptionsInputFn) {
          const result = isMobxQueryInitialized
            ? (queryOptionsInput as () => any)()
            : unpackedQueryOptionsInput;
          const {
            params,
            abortSignal,
            select,
            onDone,
            onError,
            onInit,
            enableOnDemand,
            meta,
            uniqKey,
            mergePageParam,
            ...rest
          } = result;
          resolvedUniqKey = uniqKey;
          resolvedMergePageParam = mergePageParam;
          inputResolved =
            'params' in result
              ? typeof params === 'function'
                ? callFunction(params)
                : params
              : {};
          dynamicOptions = hasEnumerableKeys(rest) ? rest : undefined;
        } else if ('params' in unpackedQueryOptionsInput) {
          inputResolved = callFunction(unpackedQueryOptionsInput.params);
          resolvedUniqKey = unpackedQueryOptionsInput.uniqKey;
          resolvedMergePageParam = unpackedQueryOptionsInput.mergePageParam;
          dynamicOptions = undefined;
        } else {
          inputResolved = {};
          resolvedUniqKey = unpackedQueryOptionsInput.uniqKey;
          resolvedMergePageParam = unpackedQueryOptionsInput.mergePageParam;
          dynamicOptions = undefined;
        }

        const hadPriorInputSample = imperativeCtx.inputParamsSampled;
        imperativeCtx.inputParamsSampled = true;

        let resolvedParams: MaybeFalsy<AnyObject>;
        if (!imperativeCtx.imperativeOverride) {
          imperativeCtx.lastInputResolved = inputResolved;
          resolvedParams = inputResolved;
        } else if (
          hadPriorInputSample &&
          inputResolved !== imperativeCtx.lastInputResolved &&
          !comparer.structural(inputResolved, imperativeCtx.lastInputResolved)
        ) {
          imperativeCtx.imperativeOverride = false;
          resolvedParams = inputResolved;
          imperativeCtx.lastInputResolved = inputResolved;
        } else {
          const sameAsCurrentParams =
            inputResolved === state.params ||
            comparer.structural(inputResolved, state.params);
          if (!sameAsCurrentParams) {
            resolvedParams = state.params ?? inputResolved;
          } else {
            imperativeCtx.imperativeOverride = false;
            resolvedParams = inputResolved;
          }
          imperativeCtx.lastInputResolved = inputResolved;
        }

        runInAction(() => {
          if (
            resolvedParams !== state.params &&
            !comparer.structural(state.params, resolvedParams)
          ) {
            state.params = resolvedParams;
          }
          if (
            resolvedUniqKey !== state.uniqKey &&
            !comparer.structural(state.uniqKey, resolvedUniqKey)
          ) {
            state.uniqKey = resolvedUniqKey;
          }
          if (!isFinite) {
            if (
              resolvedMergePageParam !== state.mergePageParam &&
              !comparer.structural(state.mergePageParam, resolvedMergePageParam)
            ) {
              state.mergePageParam = resolvedMergePageParam;
            }
          }
        });

        const builtOptions = state.buildOptions(
          resolvedParams,
          resolvedUniqKey,
        );

        let isEnabled = builtOptions.enabled;

        if (!isQueryOptionsInputFn && queryOptionsInput.enabled === false) {
          isEnabled = false;
        }

        return {
          ...builtOptions,
          enabled: isEnabled,
          ...dynamicOptions,
        };
      },
    },
  };

  return makeObservable(state, {
    params: observable.ref,
    mergePageParam: observable.ref,
    uniqKey: observable.ref,
    setParamsImperative: action,
    reset: action,
  });
}
