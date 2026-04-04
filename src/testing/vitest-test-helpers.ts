import { afterEach, vi } from 'vitest';
import { Endpoint } from '../runtime/endpoint.js';
import { EndpointQueryClient } from '../runtime/endpoint-query-client.js';
import { HttpClient } from '../runtime/http-client.js';
import type { HttpResponse } from '../runtime/http-response.js';

export const baseFullParams = {
  path: '/items',
  method: 'GET',
  format: 'json' as const,
};

export function createHttpClientWithGuardFetch() {
  const fetchMock = vi
    .fn<typeof globalThis.fetch>()
    .mockRejectedValue(new Error('fetch must not be called'));
  const httpClient = new HttpClient({
    baseUrl: 'https://api.test',
    fetch: fetchMock,
  });
  return { httpClient, fetchMock };
}

/** Test **`Endpoint`**: pass a **`queryClient`** you created first (e.g. **`new EndpointQueryClient()`**). */
export function createTestEndpoint(options: {
  queryClient: EndpointQueryClient;
}) {
  const { httpClient, fetchMock } = createHttpClientWithGuardFetch();
  const { queryClient } = options;

  const endpoint = new Endpoint<
    HttpResponse<{ value: string }, { code: string }, number>,
    { id: number },
    Record<string, never>
  >(
    {
      params: ({ id }) => ({
        path: `/items/${id}`,
        method: 'GET',
        format: 'json',
      }),
      requiredParams: ['id'],
      operationId: 'getItem',
      path: ['items', '{id}'],
      tags: [],
      meta: {},
    },
    queryClient,
    httpClient,
  );

  return { endpoint, httpClient, fetchMock };
}

export type ItemResponse = HttpResponse<
  { value: string },
  { code: string },
  number
>;

export function createThreeEndpointsOnSharedClient() {
  const { httpClient, fetchMock } = createHttpClientWithGuardFetch();
  const queryClient = new EndpointQueryClient();

  const endpointA = new Endpoint<
    ItemResponse,
    { id: number },
    Record<string, never>
  >(
    {
      params: ({ id }) => ({
        path: `/alpha/${id}`,
        method: 'GET',
        format: 'json',
      }),
      requiredParams: ['id'],
      operationId: 'alpha',
      path: ['alpha', '{id}'],
      tags: [],
      meta: {},
    },
    queryClient,
    httpClient,
  );

  const endpointB = new Endpoint<
    ItemResponse,
    { id: number },
    Record<string, never>
  >(
    {
      params: ({ id }) => ({
        path: `/beta/${id}`,
        method: 'GET',
        format: 'json',
      }),
      requiredParams: ['id'],
      operationId: 'beta',
      path: ['beta', '{id}'],
      tags: [],
      meta: {},
    },
    queryClient,
    httpClient,
  );

  const endpointC = new Endpoint<
    ItemResponse,
    { id: number },
    Record<string, never>
  >(
    {
      params: ({ id }) => ({
        path: `/gamma/${id}`,
        method: 'GET',
        format: 'json',
      }),
      requiredParams: ['id'],
      operationId: 'gamma',
      path: ['gamma', '{id}'],
      tags: [],
      meta: {},
    },
    queryClient,
    httpClient,
  );

  return { endpointA, endpointB, endpointC, fetchMock };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
