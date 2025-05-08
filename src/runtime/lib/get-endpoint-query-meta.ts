import { Query } from '@tanstack/query-core';
import { AnyObject } from 'yummies/utils/types';

import { EndpointQueryMeta } from '../endpoint-query.types.js';

export const getEndpointQueryMeta = (
  query: Query | AnyObject,
): EndpointQueryMeta | null => {
  if (query.meta && 'endpointQuery' in query.meta) {
    return query.meta as unknown as EndpointQueryMeta;
  }
  return null;
};
