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

  let imperativeOverride = false;
  let inputParamsSampled = false;
  let lastInputResolved: any;

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
      options: (queryArg: any) => {
        state.query = queryArg as any;

        let resolvedParams: MaybeFalsy<AnyObject>;
        let dynamicOptions: any;
        let resolvedUniqKey: Maybe<EndpointQueryUniqKey>;
        let resolvedMergePageParam: InternalQueryState['mergePageParam'];

        let inputResolved: MaybeFalsy<AnyObject>;

        if (isQueryOptionsInputFn) {
          // Reuse the already evaluated constructor options on the first pass.
          // This prevents an extra queryOptionsInput()/params invocation at creation time.
          // @ts-expect-error
          const result = state.query._result
            ? queryOptionsInput()
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

          if ('params' in result) {
            inputResolved = callFunction(params);
          } else {
            inputResolved = {};
          }

          dynamicOptions = hasEnumerableKeys(rest) ? rest : undefined;
        } else if ('params' in unpackedQueryOptionsInput) {
          const params = unpackedQueryOptionsInput.params;
          inputResolved = callFunction(params);
          resolvedUniqKey = unpackedQueryOptionsInput.uniqKey;
          resolvedMergePageParam = unpackedQueryOptionsInput.mergePageParam;
        } else {
          inputResolved = {};
          resolvedUniqKey = unpackedQueryOptionsInput.uniqKey;
          resolvedMergePageParam = unpackedQueryOptionsInput.mergePageParam;
        }

        const hadPriorInputSample = inputParamsSampled;
        inputParamsSampled = true;

        if (
          imperativeOverride &&
          hadPriorInputSample &&
          !comparer.structural(inputResolved, lastInputResolved)
        ) {
          imperativeOverride = false;
          resolvedParams = inputResolved;
        } else if (
          imperativeOverride &&
          (!hadPriorInputSample ||
            comparer.structural(inputResolved, lastInputResolved))
        ) {
          if (!comparer.structural(inputResolved, state.params)) {
            resolvedParams = state.params ?? inputResolved;
          } else {
            imperativeOverride = false;
            resolvedParams = inputResolved;
          }
        } else {
          resolvedParams = inputResolved;
        }

        lastInputResolved = inputResolved;

        runInAction(() => {
          if (!comparer.structural(state.params, resolvedParams)) {
            state.params = resolvedParams;
          }
          if (!comparer.structural(state.uniqKey, resolvedUniqKey)) {
            state.uniqKey = resolvedUniqKey;
          }
          if (
            !comparer.structural(state.mergePageParam, resolvedMergePageParam)
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
