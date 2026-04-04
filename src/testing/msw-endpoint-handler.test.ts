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

  const tagListEndpoint = new Endpoint<
    HttpResponse<string[], null, number>,
    Record<string, never>,
    Record<string, never>
  >(
    {
      params: () => ({
        path: '/api/v1/tags',
        method: 'GET',
        format: 'json',
      }),
      requiredParams: [],
      operationId: 'listTags',
      path: ['api', 'v1', 'tags'],
      tags: [],
      meta: {},
    },
    queryClient,
    httpClient,
  );

  const rawBytesEndpoint = new Endpoint<
    HttpResponse<ArrayBuffer, null, number>,
    Record<string, never>,
    Record<string, never>
  >(
    {
      params: () => ({
        path: '/api/v1/raw',
        method: 'GET',
        format: 'arrayBuffer',
      }),
      requiredParams: [],
      operationId: 'getRaw',
      path: ['api', 'v1', 'raw'],
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
    mswEndpointHandler(listFruitsEndpoint, async () => ({
      items: ['apple', 'banana'],
    })),
    mswEndpointHandler(tagListEndpoint, async () => ['alpha', 'beta']),
    mswEndpointHandler(rawBytesEndpoint, async () => new Uint8Array([1, 2, 3])),
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

  it('shorthand returns JSON array (primitives)', async () => {
    const res = await tagListEndpoint.request({});
    expect(res.data).toEqual(['alpha', 'beta']);
  });

  it('shorthand returns binary body (typed array)', async () => {
    const res = await rawBytesEndpoint.request({});
    expect(res.data).toBeInstanceOf(ArrayBuffer);
    expect([...new Uint8Array(res.data as ArrayBuffer)]).toEqual([1, 2, 3]);
  });

  it('scalar JSON data matches HttpResponse<TData> (string / boolean)', () => {
    const stringScalarEndpoint = new Endpoint<
      HttpResponse<string, null, number>,
      Record<string, never>,
      Record<string, never>
    >(
      {
        params: () => ({
          path: '/api/v1/scalar-string',
          method: 'GET',
          format: 'json',
        }),
        requiredParams: [],
        operationId: 'scalarString',
        path: ['api', 'v1', 'scalar-string'],
        tags: [],
        meta: {},
      },
      queryClient,
      httpClient,
    );

    const boolScalarEndpoint = new Endpoint<
      HttpResponse<boolean, null, number>,
      Record<string, never>,
      Record<string, never>
    >(
      {
        params: () => ({
          path: '/api/v1/scalar-bool',
          method: 'GET',
          format: 'json',
        }),
        requiredParams: [],
        operationId: 'scalarBool',
        path: ['api', 'v1', 'scalar-bool'],
        tags: [],
        meta: {},
      },
      queryClient,
      httpClient,
    );

    // @ts-expect-error string endpoint must not use a boolean body resolver
    mswEndpointHandler(stringScalarEndpoint, () => true);

    // @ts-expect-error boolean endpoint must not use a string body resolver
    mswEndpointHandler(boolScalarEndpoint, () => '');
  });
});
