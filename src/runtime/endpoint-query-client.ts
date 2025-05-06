import {
  InvalidateOptions,
  InvalidateQueryFilters,
} from '@tanstack/query-core';
import { MobxQueryClient } from 'mobx-tanstack-query';

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
    path: string | RegExp,
    filters?: Omit<InvalidateQueryFilters<any[]>, 'queryKey' | 'predicate'>,
    options?: InvalidateOptions,
  ) {
    return this.invalidateQueries(
      {
        ...filters,
        predicate: (query) => {
          if (query.meta?.pathDeclaration) {
            if (typeof path === 'string') {
              return String(query.meta.pathDeclaration).startsWith(path);
            }
            return path.test(String(query.meta.pathDeclaration));
          }

          return false;
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
