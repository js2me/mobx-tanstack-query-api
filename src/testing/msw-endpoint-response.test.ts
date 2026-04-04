import './vitest-test-helpers.js';
import { setupServer } from 'msw/node';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  it,
} from 'vitest';
import { Endpoint } from '../runtime/endpoint.js';
import type { EndpointQueryClient } from '../runtime/endpoint-query-client.js';
import { HttpClient } from '../runtime/http-client.js';
import type { HttpResponse } from '../runtime/http-response.js';
import { mswEndpointHandler } from './msw-endpoint-handler.js';
import {
  mswEndpointErrorResponse,
  mswEndpointResponse,
} from './msw-endpoint-response.js';

describe('mswEndpointResponse', () => {
  const httpClient = new HttpClient({ baseUrl: 'https://api.example.com' });
  const queryClient = {
    invalidateQueries: () => {},
  } as unknown as EndpointQueryClient;

  const listFruitsEndpoint = new Endpoint<
    HttpResponse<{ items: string[] }, { code: string }, number>,
    Record<string, never>,
    Record<string, never>
  >(
    {
      params: () => ({
        path: '/api/v1/fruits',
        method: 'GET',
        format: 'json',
      }),
      requiredParams: [],
      operationId: 'listFruits',
      path: ['api', 'v1', 'fruits'],
      tags: [],
      meta: {},
    },
    queryClient,
    httpClient,
  );

  it('returns a Response typed for MSW', () => {
    expectTypeOf(
      mswEndpointResponse(listFruitsEndpoint, { items: ['a'] }),
    ).toEqualTypeOf<Response>();
    expectTypeOf(
      mswEndpointErrorResponse(listFruitsEndpoint, { code: 'x' }),
    ).toEqualTypeOf<Response>();
  });

  const server = setupServer(
    mswEndpointHandler(listFruitsEndpoint, () =>
      mswEndpointResponse(listFruitsEndpoint, { items: ['apple'] }),
    ),
  );

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('works with MSW and HttpClient', async () => {
    const res = await listFruitsEndpoint.request({});
    expect(res.data).toEqual({ items: ['apple'] });
  });
});
