import { hashKey, type InvalidateOptions } from '@tanstack/query-core';
import { QueryClient, type QueryClientConfig } from 'mobx-tanstack-query';
import type { Maybe } from 'yummies/utils/types';
import type { EndpointQueryMeta } from './endpoint-query.types.js';
import type {
  EndpointStringFilter,
  InvalidateEndpointsFilters,
} from './endpoint-query-client.types.js';

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
      ...queryFilters
    }: InvalidateEndpointsFilters,
    options?: InvalidateOptions,
  ) {
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
