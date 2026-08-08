import './vitest-test-helpers.js';
import { describe, expect, it } from 'vitest';
import { EndpointQueryClient } from '../runtime/endpoint-query-client.js';
import {
  createMockHttpResponse,
  MockHttpResponse,
} from './mock-http-response.js';
import { baseFullParams, createTestEndpoint } from './vitest-test-helpers.js';

describe('MockHttpResponse', () => {
  it('createMockHttpResponse applies data from params when data is truthy', async () => {
    const r = await createMockHttpResponse({
      requestParams: baseFullParams,
      data: { id: 42 },
    });
    expect(r.data).toEqual({ id: 42 });
    expect(r.status).toBe(200);
    expect(r.ok).toBe(true);
  });

  it('new MockHttpResponse applies data from params after resolveBody', async () => {
    const r = new MockHttpResponse({
      requestParams: baseFullParams,
      data: { id: 42 },
    });
    expect(r.data).toBeNull();
    await r.resolveBody('json');
    expect(r.data).toEqual({ id: 42 });
    expect(r.status).toBe(200);
    expect(r.ok).toBe(true);
  });

  it('without truthy data and without status defaults to 500', async () => {
    const r = await createMockHttpResponse({
      requestParams: baseFullParams,
    });
    expect(r.status).toBe(500);
    expect(r.ok).toBe(false);
  });

  it('without truthy data and without status defaults to 500 (via new)', async () => {
    const r = new MockHttpResponse({
      requestParams: baseFullParams,
    });
    expect(r.status).toBe(500);
    expect(r.ok).toBe(false);
  });

  it('setData and setError sync ok and the opposite field', async () => {
    const r = await createMockHttpResponse({
      requestParams: baseFullParams,
    });
    r.setData({ a: 1 }, { status: 201, statusText: 'Created' });
    expect(r.data).toEqual({ a: 1 });
    expect(r.error).toBeNull();
    expect(r.status).toBe(201);
    expect(r.ok).toBe(true);
    expect(r.statusText).toBe('Created');

    r.setError({ code: 'x' } as any, { status: 422 });
    expect(r.error).toEqual({ code: 'x' });
    expect(r.data).toBeNull();
    expect(r.status).toBe(422);
    expect(r.ok).toBe(false);
  });

  it('resolveBody sets error from params when error is truthy', async () => {
    const r = new MockHttpResponse({
      requestParams: baseFullParams,
      error: { msg: 'e' } as any,
    });
    await r.resolveBody('json');
    expect(r.error).toEqual({ msg: 'e' });
  });

  describe('fromEndpoint', () => {
    it('derives requestParams and url from endpoint + input; data applies after resolveBody', async () => {
      const queryClient = new EndpointQueryClient();
      const { endpoint } = createTestEndpoint({ queryClient });

      const r = MockHttpResponse.fromEndpoint(endpoint, {
        input: { id: 7 },
        data: { value: 'ok' },
      });

      expect(r.request.url).toBe('https://api.test/items/7');
      expect(r.request.params).toMatchObject({
        path: '/items/7',
        method: 'GET',
      });
      expect(r.status).toBe(200);
      expect(r.ok).toBe(true);
      expect(r.data).toBeNull();

      await r.resolveBody('json');
      expect(r.data).toEqual({ value: 'ok' });
    });

    it('builds an error response typed from the endpoint', async () => {
      const queryClient = new EndpointQueryClient();
      const { endpoint } = createTestEndpoint({ queryClient });

      const r = MockHttpResponse.fromEndpoint(endpoint, {
        input: { id: 3 },
        error: { code: 'boom' },
        status: 409,
      });

      expect(r.request.url).toBe('https://api.test/items/3');
      expect(r.status).toBe(409);
      expect(r.ok).toBe(false);

      await r.resolveBody('json');
      expect(r.error).toEqual({ code: 'boom' });
    });

    it('works without input', async () => {
      const queryClient = new EndpointQueryClient();
      const { endpoint } = createTestEndpoint({ queryClient });

      const r = MockHttpResponse.fromEndpoint(endpoint, {
        data: { value: 'x' },
      });

      expect(r.request.url).toBe('https://api.test/items/undefined');
      await r.resolveBody('json');
      expect(r.data).toEqual({ value: 'x' });
    });
  });
});
