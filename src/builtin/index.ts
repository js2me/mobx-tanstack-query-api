import { hashKey } from '@tanstack/query-core';

import { EndpointQueryClient } from '../runtime/endpoint-query-client.js';
import { HttpClient, isHttpBadResponse } from '../runtime/http-client.js';

const MAX_FAILURE_COUNT = 3;

export const queryClient = new EndpointQueryClient({
  defaultOptions: {
    queries: {
      throwOnError: true,
      queryKeyHashFn: hashKey,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 5 * 60 * 1000,
      retry: (failureCount, error) => {
        if (isHttpBadResponse(error) && error.status >= 500) {
          return MAX_FAILURE_COUNT - failureCount > 0;
        }
        return false;
      },
    },
    mutations: {
      throwOnError: true,
    },
  },
});

export const http = new HttpClient({});
