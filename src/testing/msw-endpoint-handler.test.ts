import './vitest-test-helpers.js';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Endpoint } from '../runtime/endpoint.js';
import type { EndpointQueryClient } from '../runtime/endpoint-query-client.js';
import { HttpClient } from '../runtime/http-client.js';
import type { HttpResponse } from '../runtime/http-response.js';
import { mswEndpointHandler } from './msw-endpoint-handler.js';
import { mswEndpointResponse } from './msw-endpoint-response.js';

describe('mswEndpointHandler', () => {
  const httpClient = new HttpClient({
    baseUrl: 'https://api.example.com',
  });
  const queryClient = {
    invalidateQueries: () => {},
  } as unknown as EndpointQueryClient;

  const listFruitsEndpoint = new Endpoint<
    HttpResponse<{ items: string[] }, null, number>,
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

  const createFruitEndpoint = new Endpoint<
    HttpResponse<{ id: number; name: string }, null, number>,
    { body: { name: string } },
    Record<string, never>
  >(
    {
      params: ({ body }) => ({
        path: '/api/v1/fruits',
        method: 'POST',
        format: 'json',
        body,
        contentType: 'application/json',
      }),
      requiredParams: ['body'],
      operationId: 'createFruit',
      path: ['api', 'v1', 'fruits'],
      tags: [],
      meta: {},
    },
    queryClient,
    httpClient,
  );

  const server = setupServer(
    mswEndpointHandler(listFruitsEndpoint, () =>
      mswEndpointResponse(listFruitsEndpoint, { items: ['apple', 'banana'] }),
    ),
    mswEndpointHandler(createFruitEndpoint, async ({ request }) => {
      const body = (await request.json()) as { name: string };
      return mswEndpointResponse(
        createFruitEndpoint,
        { id: 1, name: body.name },
        { status: 201 },
      );
    }),
  );

  beforeAll(() =>
    server.listen({
      onUnhandledRequest: 'error',
    }),
  );
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('infers GET from configuration.params', async () => {
    const res = await listFruitsEndpoint.request({});
    expect(res.data).toEqual({ items: ['apple', 'banana'] });
  });

  it('infers POST from configuration.params', async () => {
    const res = await createFruitEndpoint.request({
      body: { name: 'kiwi' },
    });
    expect(res.data).toEqual({ id: 1, name: 'kiwi' });
  });
});
