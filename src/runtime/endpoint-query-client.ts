import {
  InvalidateOptions,
  InvalidateQueryFilters,
} from '@tanstack/query-core';
import { QueryClient } from 'mobx-tanstack-query';

import { EndpointQueryMeta } from './endpoint-query.types.js';
import { AnyEndpoint } from './endpoint.types.js';

export class EndpointQueryClient extends QueryClient {
  private invalidateByEndpointMeta(
    fn: (meta: EndpointQueryMeta) => boolean,
    filters?: Omit<InvalidateQueryFilters<any[]>, 'queryKey' | 'predicate'>,
    options?: InvalidateOptions,
  ) {
    return this.invalidateQueries(
      {
        ...filters,
        predicate: (query) => {
          if (query.meta && query.meta.endpointQuery === true) {
            return fn(query.meta as any);
          }
          return false;
        },
      },
      options,
    );
  }

  invalidateByEndpoint(
    endpoint: AnyEndpoint | AnyEndpoint[],
    filters?: Omit<InvalidateQueryFilters<any[]>, 'queryKey' | 'predicate'>,
    options?: InvalidateOptions,
  ) {
    const endpoints = Array.isArray(endpoint) ? endpoint : [endpoint];
    return this.invalidateByEndpointMeta(
      (meta) => {
        return endpoints.some(
          (endpoint) => endpoint.endpointId === meta.endpointId,
        );
      },
      filters,
      options,
    );
  }

  invalidateByOperationId(
    operationId: string | RegExp,
    filters?: Omit<InvalidateQueryFilters<any[]>, 'queryKey' | 'predicate'>,
    options?: InvalidateOptions,
  ) {
    return this.invalidateByEndpointMeta(
      (meta) => {
        if (typeof operationId === 'string') {
          return meta.operationId === operationId;
        }
        return operationId.test(meta.operationId);
      },
      filters,
      options,
    );
  }

  invalidateByPath(
    path: string[] | string | RegExp,
    filters?: Omit<InvalidateQueryFilters<any[]>, 'queryKey' | 'predicate'> & {
      segment?: number;
    },
    options?: InvalidateOptions,
  ) {
    let pathDeclarationOrRegExp: RegExp | string;

    if (Array.isArray(path)) {
      if (filters?.segment === undefined) {
        pathDeclarationOrRegExp = path.slice(0, filters?.segment).join('/');
      } else {
        pathDeclarationOrRegExp = path.join('/');
      }
    } else {
      pathDeclarationOrRegExp = path;
    }

    return this.invalidateByEndpointMeta(
      (meta) => {
        if (typeof pathDeclarationOrRegExp === 'string') {
          return meta.pathDeclaration.startsWith(pathDeclarationOrRegExp);
        }
        return pathDeclarationOrRegExp.test(meta.pathDeclaration);
      },
      filters,
      options,
    );
  }

  invalidateByTags(
    tags: any[],
    filters?: Omit<InvalidateQueryFilters<any[]>, 'queryKey' | 'predicate'>,
    options?: InvalidateOptions,
  ) {
    return this.invalidateQueries(
      {
        ...filters,
        predicate: (query) => {
          if (Array.isArray(query.meta?.tags)) {
            return query.meta.tags.some((tag) => tags.includes(tag));
          }

          return false;
        },
      },
      options,
    );
  }
}
