/**
 * Mirrors the code examples under docs/testing/ — keep in sync when editing those pages.
 */
import './vitest-test-helpers.js';
import { describe, expect, it, vi } from 'vitest';
import { Endpoint } from '../runtime/endpoint.js';
import type { EndpointQueryClient } from '../runtime/endpoint-query-client.js';
import type { HttpClient } from '../runtime/http-client.js';
import type { HttpResponse } from '../runtime/http-response.js';
import { isHttpResponse } from '../runtime/http-response.js';
import { captureEndpointRequestParams } from './capture-endpoint-request-params.js';
import { captureInvalidations } from './capture-invalidations.js';
import { mockEndpointRequest } from './mock-endpoint-request.js';
import { mockEndpointRequestOnce } from './mock-endpoint-request-once.js';
import { mockEndpointRequestSequence } from './mock-endpoint-request-sequence.js';
import { mockEndpointRequestWhen } from './mock-endpoint-request-when.js';
import { mockHttpClientRequest } from './mock-http-client-request.js';
import { mockHttpClientRequestOnce } from './mock-http-client-request-once.js';
import { mockHttpClientRequestSequence } from './mock-http-client-request-sequence.js';
import { createMockHttpResponse } from './mock-http-response.js';
import { mswPathPattern } from './msw-path-pattern.js';
import { stubEndpointThrow } from './stub-endpoint-throw.js';
import { createMockHttpClientRequestHandler } from './utils/mock-http-client-request-handler.js';
import {
  createHttpClientWithGuardFetch,
  createTestEndpoint,
} from './vitest-test-helpers.js';

function createQueryClientStub(): EndpointQueryClient {
  return { invalidateQueries: vi.fn() } as unknown as EndpointQueryClient;
}

function createGetUserLike(httpClient: HttpClient) {
  return new Endpoint<
    HttpResponse<{ name: string }, { code: string }, number>,
    { id: number },
    Record<string, never>
  >(
    {
      params: ({ id }) => ({
        path: `/users/${id}`,
        method: 'GET',
        format: 'json',
      }),
      requiredParams: ['id'],
      operationId: 'getUser',
      path: ['users', '{id}'],
      tags: [],
      meta: {},
    },
    createQueryClientStub(),
    httpClient,
  );
}

function createGetUserTierLike(httpClient: HttpClient) {
  return new Endpoint<
    HttpResponse<{ tier: string }, { code: string }, number>,
    { id: number },
    Record<string, never>
  >(
    {
      params: ({ id }) => ({
        path: `/users/${id}`,
        method: 'GET',
        format: 'json',
      }),
      requiredParams: ['id'],
      operationId: 'getUserTier',
      path: ['users', '{id}'],
      tags: [],
      meta: {},
    },
    createQueryClientStub(),
    httpClient,
  );
}

function createSearchUsersLike(httpClient: HttpClient) {
  return new Endpoint<
    HttpResponse<{ users: unknown[] }, { code: string }, number>,
    { q: string },
    Record<string, never>
  >(
    {
      params: ({ q }) => ({
        path: `/search/${encodeURIComponent(q as string)}`,
        method: 'GET',
        format: 'json',
      }),
      requiredParams: ['q'],
      operationId: 'searchUsers',
      path: ['search', '{q}'],
      tags: [],
      meta: {},
    },
    createQueryClientStub(),
    httpClient,
  );
}

function createUpdateItemLike(httpClient: HttpClient) {
  return new Endpoint<
    HttpResponse<{ ok: boolean }, { code: string }, number>,
    { id: number; body: { title: string } },
    Record<string, never>
  >(
    {
      params: ({ id, body }) => ({
        path: `/items/${id}`,
        method: 'PATCH',
        format: 'json',
        body,
      }),
      requiredParams: ['id', 'body'],
      operationId: 'updateItem',
      path: ['items', '{id}'],
      tags: [],
      meta: {},
    },
    createQueryClientStub(),
    httpClient,
  );
}

function createCreateItemLike(httpClient: HttpClient) {
  return new Endpoint<
    HttpResponse<{ id: number }, { code: string }, number>,
    { body: { name: string } },
    Record<string, never>
  >(
    {
      params: ({ body }) => ({
        path: '/items',
        method: 'POST',
        format: 'json',
        body,
      }),
      requiredParams: ['body'],
      operationId: 'createItem',
      path: ['items'],
      tags: [],
      meta: {},
    },
    createQueryClientStub(),
    httpClient,
  );
}

function createDeleteItemLike(httpClient: HttpClient) {
  return new Endpoint<
    HttpResponse<{ deleted: boolean }, { code: string }, number>,
    { id: number },
    Record<string, never>
  >(
    {
      params: ({ id }) => ({
        path: `/items/${id}`,
        method: 'DELETE',
        format: 'json',
      }),
      requiredParams: ['id'],
      operationId: 'deleteItem',
      path: ['items', '{id}'],
      tags: [],
      meta: {},
    },
    createQueryClientStub(),
    httpClient,
  );
}

describe('docs/testing examples', () => {
  it('Shared concepts: success then error (two mockHttpClientRequestOnce)', async () => {
    const { httpClient } = createHttpClientWithGuardFetch();
    mockHttpClientRequestOnce(httpClient, { success: { id: 1 } });
    mockHttpClientRequestOnce(httpClient, {
      error: { message: 'Not found' },
      status: 404,
    });

    const first = await httpClient.request<{ id: number }, { message: string }>(
      {
        path: '/a',
        method: 'GET',
        format: 'json',
      },
    );
    expect(first.data).toEqual({ id: 1 });

    await expect(
      httpClient.request({ path: '/b', method: 'GET', format: 'json' }),
    ).rejects.toSatisfy((e) => isHttpResponse(e, 404));
  });

  it('createMockHttpResponse example', async () => {
    const response = await createMockHttpResponse({
      requestParams: { path: '/users', method: 'GET', format: 'json' },
      data: { name: 'Ada' },
    });
    expect(response.data).toEqual({ name: 'Ada' });
  });

  it('mswPathPattern example (getUser)', () => {
    const { httpClient } = createHttpClientWithGuardFetch();
    const getUser = createGetUserLike(httpClient);
    expect(mswPathPattern(getUser)).toBe('https://api.test/users/:id');
  });

  it('createMockHttpClientRequestHandler example', async () => {
    const { httpClient } = createHttpClientWithGuardFetch();
    const handler = createMockHttpClientRequestHandler(httpClient, {
      success: { ok: true },
    });
    const spy = vi.spyOn(httpClient, 'request').mockImplementation(handler);
    const res = await httpClient.request<{ ok: boolean }, null>({
      path: '/x',
      method: 'GET',
      format: 'json',
    });
    expect(res.data).toEqual({ ok: true });
    spy.mockRestore();
  });

  it('mockHttpClientRequest: stub every call until restore', async () => {
    const { httpClient } = createHttpClientWithGuardFetch();
    const spy = mockHttpClientRequest(httpClient, { success: { items: [] } });
    const res = await httpClient.request({
      path: '/items',
      method: 'GET',
      format: 'json',
    });
    expect(res.data).toEqual({ items: [] });
    spy.mockRestore();
  });

  it('mockHttpClientRequestOnce: only the next request', async () => {
    const { httpClient, fetchMock } = createHttpClientWithGuardFetch();
    mockHttpClientRequestOnce(httpClient, { success: { id: 1 } });
    await httpClient.request({ path: '/x', method: 'GET', format: 'json' });
    await expect(
      httpClient.request({ path: '/x', method: 'GET', format: 'json' }),
    ).rejects.toThrow('fetch must not be called');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('mockEndpointRequest: same response on every call (getUser)', async () => {
    const { httpClient } = createHttpClientWithGuardFetch();
    const getUser = createGetUserLike(httpClient);
    const spy = mockEndpointRequest(getUser, { success: { name: 'Ann' } });
    const r = await getUser.request({ id: 42 });
    expect(r.data).toEqual({ name: 'Ann' });
    spy.mockRestore();
  });

  it('mockEndpointRequestOnce: first call only (getUser)', async () => {
    const { httpClient, fetchMock } = createHttpClientWithGuardFetch();
    const getUser = createGetUserLike(httpClient);
    mockEndpointRequestOnce(getUser, { success: { name: 'Once' } });
    await getUser.request({ id: 1 });
    await expect(getUser.request({ id: 2 })).rejects.toThrow(
      'fetch must not be called',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('mockEndpointRequestSequence example (searchUsers)', async () => {
    const { httpClient, fetchMock } = createHttpClientWithGuardFetch();
    const searchUsers = createSearchUsersLike(httpClient);
    const spy = mockEndpointRequestSequence(searchUsers, [
      { error: { code: 'TIMEOUT' }, status: 504 },
      { success: { users: [] } },
    ]);
    await expect(searchUsers.request({ q: 'a' })).rejects.toSatisfy((e) =>
      isHttpResponse(e, 504),
    );
    await expect(searchUsers.request({ q: 'a' })).resolves.toMatchObject({
      data: { users: [] },
    });
    await expect(searchUsers.request({ q: 'b' })).rejects.toThrow(
      'fetch must not be called',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('mockHttpClientRequestSequence example (searchUsers)', async () => {
    const { httpClient, fetchMock } = createHttpClientWithGuardFetch();
    const searchUsers = createSearchUsersLike(httpClient);
    const spy = mockHttpClientRequestSequence(httpClient, [
      { error: { code: 'TIMEOUT' }, status: 504 },
      { success: { users: [] } },
    ]);
    await expect(searchUsers.request({ q: 'a' })).rejects.toSatisfy((e) =>
      isHttpResponse(e, 504),
    );
    await expect(searchUsers.request({ q: 'a' })).resolves.toMatchObject({
      data: { users: [] },
    });
    await expect(searchUsers.request({ q: 'b' })).rejects.toThrow(
      'fetch must not be called',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('mockEndpointRequestWhen example (getUser + tier)', async () => {
    const { httpClient, fetchMock } = createHttpClientWithGuardFetch();
    const getUser = createGetUserTierLike(httpClient);
    const spy = mockEndpointRequestWhen(getUser, (p) => p.id >= 1000, {
      success: { tier: 'vip' },
    });
    await expect(getUser.request({ id: 1 })).rejects.toThrow(
      'fetch must not be called',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(getUser.request({ id: 1000 })).resolves.toMatchObject({
      data: { tier: 'vip' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('captureEndpointRequestParams + mockHttpClientRequestOnce (updateItem)', async () => {
    const { httpClient } = createHttpClientWithGuardFetch();
    const updateItem = createUpdateItemLike(httpClient);
    const cap = captureEndpointRequestParams(updateItem);
    mockHttpClientRequestOnce(httpClient, { success: { ok: true } });

    await updateItem.request({ id: 7, body: { title: 'x' } });

    expect(cap.last?.path).toBe('/items/7');
    expect(cap.last?.method).toBe('PATCH');
    cap.restore();
  });

  it('captureEndpointRequestParams waitNext (createItem)', async () => {
    const { httpClient } = createHttpClientWithGuardFetch();
    const createItem = createCreateItemLike(httpClient);
    const cap = captureEndpointRequestParams(createItem);
    mockHttpClientRequestOnce(httpClient, { success: { id: 1 } });
    const nextParams = cap.waitNext();
    const requestPromise = createItem.request({ body: { name: 'a' } });
    const params = await nextParams;
    await requestPromise;
    expect(params.path).toContain('/items');
    cap.restore();
  });

  it('captureInvalidations (invalidateQuery filters)', () => {
    const cap = captureInvalidations();
    const { endpoint } = createTestEndpoint({ queryClient: cap.queryClient });

    endpoint.invalidateQuery({ id: 7 });

    expect(cap.last?.filters.exact).toBe(true);
    expect(cap.last?.filters.queryKey).toContainEqual('getItem');
    expect(cap.last?.filters.queryKey).toContainEqual({ id: 7 });
    cap.restore();
  });

  it('captureInvalidations waitNext', async () => {
    const cap = captureInvalidations();
    const { endpoint } = createTestEndpoint({ queryClient: cap.queryClient });
    const next = cap.waitNext();
    endpoint.invalidateQuery({ id: 3 });
    const recorded = await next;
    expect(recorded.filters.queryKey).toContainEqual('getItem');
    expect(recorded.filters.queryKey).toContainEqual({ id: 3 });
    cap.restore();
  });

  it('stubEndpointThrow: one failure then real client', async () => {
    const { httpClient, fetchMock } = createHttpClientWithGuardFetch();
    const deleteItem = createDeleteItemLike(httpClient);
    const spy = stubEndpointThrow(deleteItem, new Error('offline'));
    await expect(deleteItem.request({ id: 1 })).rejects.toThrow('offline');
    await expect(deleteItem.request({ id: 2 })).rejects.toThrow(
      'fetch must not be called',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('stubEndpointThrow: persistent', async () => {
    const { httpClient } = createHttpClientWithGuardFetch();
    const deleteItem = createDeleteItemLike(httpClient);
    const spy = stubEndpointThrow(deleteItem, () => new Error('forbidden'), {
      persistent: true,
    });
    await expect(deleteItem.request({ id: 1 })).rejects.toThrow('forbidden');
    await expect(deleteItem.request({ id: 2 })).rejects.toThrow('forbidden');
    spy.mockRestore();
  });
});
