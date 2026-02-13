import { noop } from 'lodash-es';
import { computed, makeObservable, reaction } from 'mobx';
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
      meta: {} as any,
    },
    queryClient,
    httpClient as any,
  );

describe('Endpoint generated example', () => {
  it('проверяет тип возвращаемого значения createFruitEndpoint', () => {
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

  it('формирует запрос с телом и requestParams', async () => {
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

  it('callable-инстанс endpoint вызывает request', async () => {
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

  it('вызывает onDone один раз при чтении query.data внутри computed', async ({
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
});
