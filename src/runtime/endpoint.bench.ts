import { bench, describe } from 'vitest';
import {
  createHttpClientWithGuardFetch,
  createTestEndpoint,
} from '../testing/vitest-test-helpers.js';
import { EndpointQueryClient } from './endpoint-query-client.js';
import { HttpResponse } from './http-response.js';

const createEndpoint = () => {
  const queryClient = new EndpointQueryClient();
  return createTestEndpoint({ queryClient }).endpoint;
};

describe('Endpoint', () => {
  bench('create Endpoint (callable)', () => {
    createEndpoint();
  });

  bench('getFullUrl', () => {
    const endpoint = createEndpoint();
    endpoint.getFullUrl({ id: 1 });
  });

  bench('getPath', () => {
    const endpoint = createEndpoint();
    endpoint.getPath({ id: 1 });
  });

  bench('toQueryKey', () => {
    const endpoint = createEndpoint();
    endpoint.toQueryKey({ id: 1 });
  });

  bench('toQueryKey with uniqKey', () => {
    const endpoint = createEndpoint();
    endpoint.toQueryKey({ id: 1 }, 'uniq');
  });

  bench('toInfiniteQueryKey', () => {
    const endpoint = createEndpoint();
    endpoint.toInfiniteQueryKey({ id: 1 });
  });

  bench('toQueryMeta', () => {
    const endpoint = createEndpoint();
    endpoint.toQueryMeta();
  });

  bench('checkResponse', () => {
    const endpoint = createEndpoint();
    const response = new HttpResponse(
      new Response(JSON.stringify({ value: 'ok' }), { status: 200 }),
      { url: 'https://api.test/items/1', params: {} },
    );
    endpoint.checkResponse(response);
    endpoint.checkResponse(response, 200);
    endpoint.checkResponse({ data: null });
  });

  bench('request', async () => {
    const queryClient = new EndpointQueryClient();
    const { endpoint, fetchMock } = createTestEndpoint({ queryClient });
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ value: 'ok' }), { status: 200 }),
    );
    await endpoint.request({ id: 1 });
  });

  bench('callable invocation', async () => {
    const queryClient = new EndpointQueryClient();
    const { endpoint, fetchMock } = createTestEndpoint({ queryClient });
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ value: 'ok' }), { status: 200 }),
    );
    await endpoint({ id: 1 });
  });

  bench('invalidateQuery', () => {
    const queryClient = new EndpointQueryClient();
    const { endpoint } = createTestEndpoint({ queryClient });
    endpoint.invalidateQuery({ id: 1 });
  });

  bench('getParamsFromContext', () => {
    const endpoint = createEndpoint();
    endpoint.getParamsFromContext({
      queryKey: ['items', '{id}', 'getItem', { id: 1 }, undefined],
    } as any);
  });
});

describe('Endpoint url building through HttpClient', () => {
  bench('buildUrl via endpoint configuration params', () => {
    const { httpClient } = createHttpClientWithGuardFetch();
    const endpoint = createEndpoint();
    httpClient.buildUrl(endpoint.configuration.params({ id: 1 }), endpoint);
  });
});
