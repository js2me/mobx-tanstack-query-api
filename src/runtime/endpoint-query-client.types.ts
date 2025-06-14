import { InvalidateQueryFilters } from '@tanstack/query-core';

import { EndpointQueryMeta } from './endpoint-query.types.js';
import { AnyEndpoint } from './endpoint.types.js';

interface InvalidateEndpointQueryFilters
  extends Omit<InvalidateQueryFilters<any[]>, 'queryKey' | 'predicate'> {}

export type EndpointStringFilter = string[] | string | RegExp;

export interface InvalidateEndpointsFilters
  extends InvalidateEndpointQueryFilters {
  predicate?: (
    meta: EndpointQueryMeta,
    query: Parameters<Required<InvalidateQueryFilters>['predicate']>[0],
  ) => boolean;
  endpoint?: AnyEndpoint | AnyEndpoint[];
  namespace?: EndpointStringFilter;
  group?: EndpointStringFilter;
  operationId?: EndpointStringFilter;
  tag?: EndpointStringFilter;
}
