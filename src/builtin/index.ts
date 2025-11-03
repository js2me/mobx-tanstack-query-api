import {
  EndpointQueryClient,
  HttpClient,
  isHttpBadResponse,
} from 'mobx-tanstack-query-api';

const MAX_FAILURE_COUNT = 3;

export const queryClient = new EndpointQueryClient({
  defaultOptions: {
    queries: {
      throwOnError: true,
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
