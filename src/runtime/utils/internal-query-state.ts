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
  isInfinite?: boolean;
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
    isInfinite,
    endpointQueryClient,
    queryOptionsInput,
  }: {
    isInfinite: boolean;
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

  let imperativeOverride = false;
  let inputParamsSampled = false;
  let lastInputResolved: any;

  const state: InternalQueryState<TParams> = {
    query: null as any,
    transformResponse,
    isInfinite,
    params: null,
    uniqKey: unpackedQueryOptionsInput.uniqKey,
    mergePageParam,
    endpoint,
    buildOptions(params, uniqKey) {
      return buildOptionsFromParams(
        this.endpoint,
        params,
        uniqKey ?? this.uniqKey,
        isInfinite,
      );
    },
    setParamsImperative(params) {
      imperativeOverride = true;
      this.params = params;
    },
    reset() {
      imperativeOverride = false;
      inputParamsSampled = false;
      lastInputResolved = undefined;
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
          const result: EndpointInfiniteQueryOptions<any, any> =
            isMobxQueryInitialized
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
            getPreviousPageParam,
            getNextPageParam,
            transform,
            transformError,
            dynamicOptionsComparer,
            notifyOnChangeProps,
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
          const p = unpackedQueryOptionsInput.params;
          inputResolved = typeof p === 'function' ? callFunction(p) : p;
          resolvedUniqKey = unpackedQueryOptionsInput.uniqKey;
          resolvedMergePageParam = unpackedQueryOptionsInput.mergePageParam;
          dynamicOptions = undefined;
        } else {
          inputResolved = {};
          resolvedUniqKey = unpackedQueryOptionsInput.uniqKey;
          resolvedMergePageParam = unpackedQueryOptionsInput.mergePageParam;
          dynamicOptions = undefined;
        }

        const hadPriorInputSample = inputParamsSampled;
        inputParamsSampled = true;

        let resolvedParams: MaybeFalsy<AnyObject>;

        if (!imperativeOverride) {
          lastInputResolved = inputResolved;
          resolvedParams = inputResolved;
        } else if (
          hadPriorInputSample &&
          inputResolved !== lastInputResolved &&
          !comparer.shallow(inputResolved, lastInputResolved)
        ) {
          imperativeOverride = false;
          resolvedParams = inputResolved;
          lastInputResolved = inputResolved;
        } else {
          if (comparer.shallow(inputResolved, state.params)) {
            imperativeOverride = false;
            resolvedParams = inputResolved;
          } else {
            resolvedParams = state.params;
          }
          lastInputResolved = inputResolved;
        }

        runInAction(() => {
          if (!comparer.shallow(state.params, resolvedParams)) {
            state.params = resolvedParams;
          }
          if (!comparer.shallow(state.uniqKey, resolvedUniqKey)) {
            state.uniqKey = resolvedUniqKey;
          }
          if (
            isInfinite &&
            !comparer.shallow(state.mergePageParam, resolvedMergePageParam)
          ) {
            state.mergePageParam = resolvedMergePageParam;
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
