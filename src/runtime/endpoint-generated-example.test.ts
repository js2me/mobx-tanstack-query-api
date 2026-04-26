import { noop } from 'es-toolkit';
import {
  computed,
  makeObservable,
  observable,
  reaction,
  runInAction,
} from 'mobx';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { sleep } from 'yummies/async';
import { Endpoint } from './endpoint.js';
import { EndpointQueryClient } from './endpoint-query-client.js';
import type { RequestParams } from './http-client.js';
import type { HttpMultistatusResponse } from './http-response.js';

type StarData = Record<string, unknown>;

interface FruitBody {
  name: string;
  color: string;
  size?: string;
  note?: string;
}

type PlanetError = {
  code?: number;
  details?: { count: number }[];
  message?: string;
};

type FruitParams = {
  fruitId: number;
  body: FruitBody;
  requestParams?: RequestParams;
};

interface StarConflictError {
  code?: number;
  details?: { text: string }[];
  message?: string;
}

const createFruitEndpoint = (
  queryClient: EndpointQueryClient,
  httpClient: {
    request: ReturnType<typeof vi.fn>;
    buildUrl: ReturnType<typeof vi.fn>;
  },
) =>
  new Endpoint<
    HttpMultistatusResponse<
      {
        200: StarData;
        409: StarConflictError;
      },
      StarData,
      PlanetError
    >,
    FruitParams,
    any
  >(
    {
      params: ({ fruitId, body, requestParams }) => ({
        path: `/api/v1/fruits/${fruitId}/stars`,
        method: 'POST',
        body,
        contentType: 'application/json',
        format: 'json',
        ...requestParams,
      }),
      requiredParams: ['fruitId', 'body'],
      operationId: 'addFruitStar',
      path: ['api', 'v1', 'fruits', '{fruitId}', 'stars'],
      tags: ['TestFruits'],
      meta: {},
    },
    queryClient,
    httpClient as any,
  );

describe('Endpoint generated example', () => {
  it('asserts createFruitEndpoint return types', () => {
    type EndpointInstance = ReturnType<typeof createFruitEndpoint>;
    type EndpointRequestResponse = Awaited<
      ReturnType<EndpointInstance['request']>
    >;
    type EndpointCallableResponse = Awaited<ReturnType<EndpointInstance>>;
    type ExpectedResponse = HttpMultistatusResponse<
      {
        200: StarData;
        409: StarConflictError;
      },
      StarData,
      PlanetError
    >;

    type Response200 = Extract<EndpointRequestResponse, { status: 200 }>;
    type Response409 = Extract<EndpointRequestResponse, { status: 409 }>;

    expectTypeOf<EndpointRequestResponse>().toEqualTypeOf<ExpectedResponse>();
    expectTypeOf<EndpointCallableResponse>().toEqualTypeOf<ExpectedResponse>();
    expectTypeOf<Response200['data']>().toEqualTypeOf<StarData>();
    expectTypeOf<Response200['error']>().toEqualTypeOf<PlanetError>();
    expectTypeOf<Response409['data']>().toEqualTypeOf<StarData>();
    expectTypeOf<Response409['error']>().toEqualTypeOf<StarConflictError>();
  });

  it('builds request with body and requestParams', async () => {
    const requestMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      data: { id: 1 },
      error: null,
    });
    const buildUrlMock = vi.fn();
    const queryClient = {
      invalidateQueries: vi.fn(),
    } as unknown as EndpointQueryClient;

    const endpoint = createFruitEndpoint(queryClient, {
      request: requestMock,
      buildUrl: buildUrlMock,
    });

    const requestParams: RequestParams = {
      headers: { 'x-test-header': 'x-test-value' },
    };

    const response = await endpoint.request({
      fruitId: 73,
      body: { name: 'apple', color: 'red' },
      requestParams,
    });

    if (response.status === 200) {
      expectTypeOf(response.data).toEqualTypeOf<StarData>();
      expectTypeOf(response.error).toEqualTypeOf<PlanetError>();
    }

    if (response.status === 409) {
      expectTypeOf(response.data).toEqualTypeOf<StarData>();
      expectTypeOf(response.error).toEqualTypeOf<StarConflictError>();
    } else if (response.status !== 200) {
      expectTypeOf(response.data).toEqualTypeOf<StarData>();
      expectTypeOf(response.error).toEqualTypeOf<PlanetError>();
    }

    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledWith(
      {
        path: '/api/v1/fruits/73/stars',
        method: 'POST',
        body: { name: 'apple', color: 'red' },
        contentType: 'application/json',
        format: 'json',
        headers: { 'x-test-header': 'x-test-value' },
      },
      endpoint,
    );
  });

  it('callable endpoint instance delegates to request', async () => {
    const requestMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      data: {},
      error: null,
    });
    const queryClient = {
      invalidateQueries: vi.fn(),
    } as unknown as EndpointQueryClient;

    const endpoint = createFruitEndpoint(queryClient, {
      request: requestMock,
      buildUrl: vi.fn(),
    });

    await endpoint({
      fruitId: 9,
      body: { name: 'banana', color: 'yellow' },
    });

    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(endpoint.configuration.requiredParams).toEqual(['fruitId', 'body']);
    expect(endpoint.operationId).toBe('addFruitStar');
    expect(endpoint.pathDeclaration).toBe('api/v1/fruits/{fruitId}/stars');
  });

  it('invokes onDone once when reading query.data inside computed', async ({
    signal,
  }) => {
    const requestMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      data: {
        foo: {
          foo: 'bar',
        },
      },
      error: null,
    });
    const queryClient = new EndpointQueryClient({
      defaultOptions: {
        queries: {
          enableOnDemand: true,
        },
      },
    });
    const endpoint = createFruitEndpoint(queryClient, {
      request: requestMock,
      buildUrl: vi.fn(),
    });
    const onDone = vi.fn();

    class Foo {
      query = endpoint.toQuery({
        enableOnDemand: true,
        params: {
          fruitId: 42,
          body: { name: 'apple', color: 'red' },
        },
        onDone: () => {
          this.data?.foo;
          onDone();
        },
      });

      constructor() {
        makeObservable(this, {
          data: computed.struct,
        });
      }

      get data(): { foo?: string } | null {
        return this.query.data?.foo || null;
      }
    }

    const foo = new Foo();

    reaction(() => foo.data, noop, { fireImmediately: true, signal });

    await sleep();
    // await foo.query.refetch();

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledTimes(1);

    await foo.query.refetch();

    expect(onDone).toHaveBeenCalledTimes(2);
    expect(requestMock).toHaveBeenCalledTimes(2);

    foo.query.destroy();
  });

  it('toInfiniteQuery merges pageParam into body and keeps base params in queryKey', async () => {
    const requestMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      data: {
        items: [{ id: 1 }],
      },
      error: null,
    });
    const queryClient = new EndpointQueryClient({
      defaultOptions: {
        queries: {
          enableOnDemand: true,
        },
      },
    });
    const endpoint = createFruitEndpoint(queryClient, {
      request: requestMock,
      buildUrl: vi.fn(),
    });
    const baseParams: FruitParams = {
      fruitId: 11,
      body: { name: 'orange', color: 'orange' },
    };

    const query = endpoint.toInfiniteQuery({
      enableOnDemand: true,
      params: baseParams,
      mergePageParam: 'body',
      initialPageParam: { limit: 50, offset: 0 },
      getNextPageParam: () => undefined,
    });

    expect(query.options.queryKey).toEqual(
      endpoint.toInfiniteQueryKey(baseParams),
    );

    await query.refetch();

    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledWith(
      {
        path: '/api/v1/fruits/11/stars',
        method: 'POST',
        body: {
          name: 'orange',
          color: 'orange',
          limit: 50,
          offset: 0,
        },
        contentType: 'application/json',
        format: 'json',
        signal: expect.any(AbortSignal),
      },
      endpoint,
    );
    expect(query.params).toEqual(baseParams);
    expect(query.response?.data).toEqual({
      items: [{ id: 1 }],
    });
  });

  it('toInfiniteQuery reactively updates base params', async () => {
    const requestMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      data: {
        items: [],
      },
      error: null,
    });
    const queryClient = new EndpointQueryClient({
      defaultOptions: {
        queries: {
          enableOnDemand: true,
        },
      },
    });
    const endpoint = createFruitEndpoint(queryClient, {
      request: requestMock,
      buildUrl: vi.fn(),
    });
    const tableParams = observable.box<FruitParams | null>(null, {
      deep: false,
    });
    const query = endpoint.toInfiniteQuery(() => ({
      enableOnDemand: true,
      params: tableParams.get(),
      mergePageParam: 'body',
      initialPageParam: { limit: 25, offset: 0 },
      getNextPageParam: () => undefined,
    }));
    const dispose = reaction(() => query.result, noop, {
      fireImmediately: true,
    });

    await sleep();
    expect(query.params).toBe(null);

    runInAction(() => {
      tableParams.set({
        fruitId: 99,
        body: { name: 'pear', color: 'green' },
      });
    });

    await sleep();

    expect(query.params).toEqual({
      fruitId: 99,
      body: { name: 'pear', color: 'green' },
    });
    expect(query.options.queryKey).toEqual(
      endpoint.toInfiniteQueryKey({
        fruitId: 99,
        body: { name: 'pear', color: 'green' },
      }),
    );

    dispose();
  });
});
