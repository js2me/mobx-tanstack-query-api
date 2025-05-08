import {
  InvalidateOptions,
  InvalidateQueryFilters,
} from '@tanstack/query-core';
import { MobxQueryClient } from 'mobx-tanstack-query';

import { getEndpointQueryMeta } from './lib/get-endpoint-query-meta.js';

export class EndpointQueryClient extends MobxQueryClient {
  invalidateByOperationId(
    operationId: string | RegExp,
    filters?: Omit<InvalidateQueryFilters<any[]>, 'queryKey' | 'predicate'>,
    options?: InvalidateOptions,
  ) {
    return this.invalidateQueries(
      {
        ...filters,
        predicate: (query) => {
          if (query.meta?.operationId) {
            if (typeof operationId === 'string') {
              return query.meta?.operationId === operationId;
            }
            return operationId.test(String(query.meta.operationId));
          }

          return false;
        },
      },
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
    const { segment, ...queryFilters } = filters ?? {};

    let pathDeclarationOrRegExp: RegExp | string;

    if (Array.isArray(path)) {
      if (segment === undefined) {
        pathDeclarationOrRegExp = path.slice(0, segment).join('/');
      } else {
        pathDeclarationOrRegExp = path.join('/');
      }
    } else {
      pathDeclarationOrRegExp = path;
    }

    return this.invalidateQueries(
      {
        ...queryFilters,
        predicate: (query) => {
          const meta = getEndpointQueryMeta(query);

          if (!meta) return false;

          if (typeof pathDeclarationOrRegExp === 'string') {
            return meta.pathDeclaration.startsWith(pathDeclarationOrRegExp);
          }
          return pathDeclarationOrRegExp.test(meta.pathDeclaration);
        },
      },
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
