import { hashKey, type InvalidateOptions } from '@tanstack/query-core';
import { QueryClient, type QueryClientConfig } from 'mobx-tanstack-query';
import type { Maybe } from 'yummies/types';
import type { EndpointQueryMeta } from './endpoint-query.types.js';
import type {
  EndpointStringFilter,
  InvalidateEndpointsFilters,
} from './endpoint-query-client.types.js';

/**
 * Class that extends `QueryClient` and gives a bit more control over endpoint queries and mutations.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/endpoint-query-client/)
 */
export class EndpointQueryClient extends QueryClient {
  constructor(config?: QueryClientConfig) {
    super({
      ...config,
      defaultOptions: {
        ...config?.defaultOptions,
        queries: {
          ...config?.defaultOptions?.queries,
          queryKeyHashFn:
            config?.defaultOptions?.queries?.queryKeyHashFn ?? hashKey,
        },
      },
    });
  }

  invalidateEndpoints(
    {
      group,
      namespace,
      operationId,
      tag,
      predicate,
      endpoint,
      exclude,
      ...queryFilters
    }: InvalidateEndpointsFilters,
    options?: InvalidateOptions,
  ) {
    const endpointIdsToExclude = new Set<string>(
      exclude?.endpoints?.map((it) => it.endpointId),
    );
    const endpointTagsToExclude = new Set<string>(exclude?.tags ?? []);

    let endpointIdsToFilter: Maybe<Set<string>>;

    if (Array.isArray(endpoint)) {
      endpointIdsToFilter = new Set(endpoint.map((it) => it.endpointId));
    } else if (endpoint) {
      endpointIdsToFilter = new Set([endpoint.endpointId]);
    }

    return this.invalidateQueries(
      {
        ...queryFilters,
        predicate: (query) => {
          if (!query.meta?.endpointQuery) {
            return false;
          }

          const meta = query.meta as unknown as EndpointQueryMeta;

          if (
            endpointIdsToExclude.has(meta.endpointId) ||
            (endpointTagsToExclude.size &&
              meta.tags.some((tag) => endpointTagsToExclude.has(tag)))
          ) {
            return false;
          }

          if (
            endpointIdsToFilter &&
            !endpointIdsToFilter.has(meta.endpointId)
          ) {
            return false;
          }

          if (
            namespace &&
            meta.namespace &&
            !applyStringFilter(namespace, meta.namespace)
          ) {
            return false;
          }

          if (group && meta.group && !applyStringFilter(group, meta.group)) {
            return false;
          }

          if (tag && meta.tags && !applyStringFilter(tag, meta.tags)) {
            return false;
          }

          if (tag && meta.tags && !applyStringFilter(tag, meta.tags)) {
            return false;
          }

          if (
            operationId &&
            !applyStringFilter(operationId, meta.operationId)
          ) {
            return false;
          }

          if (predicate && !predicate(meta, query as any)) {
            return false;
          }

          return true;
        },
      },
      options,
    );
  }
}

const applyStringFilter = (
  filter: EndpointStringFilter,
  value: string | string[],
): boolean => {
  const values = Array.isArray(value) ? value : [value];

  if (filter instanceof RegExp) {
    return values.some((value) => filter.test(value));
  }

  if (Array.isArray(filter)) {
    return filter.some((filter) => values.includes(filter));
  }

  return values.includes(filter);
};
