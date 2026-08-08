import { bench, describe, vi } from 'vitest';
import { ContentType, HttpClient } from './http-client.js';

const createClient = () =>
  new HttpClient({
    baseUrl: 'https://api.example.com',
    fetch: vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 1 }), { status: 200 }),
      ),
  });

type HttpClientInternals = {
  mergeRequestParams: HttpClient['mergeRequestParams'];
  toQueryString: (query?: Record<string, any>) => string;
};

const asInternals = (client: HttpClient) =>
  client as unknown as HttpClientInternals;

describe('HttpClient', () => {
  bench('create HttpClient', () => {
    createClient();
  });

  bench('buildUrl', () => {
    const client = createClient();
    client.buildUrl({
      path: '/users',
      method: 'GET',
      query: { page: 1, filter: 'active' },
    });
  });

  bench('buildUrl with serverVars', () => {
    const client = new HttpClient({
      baseUrl: 'https://{env}.api.example.com/{version}',
      fetch: vi.fn<typeof globalThis.fetch>(),
    });
    client.buildUrl({
      path: '/users',
      method: 'GET',
      serverVars: { env: 'prod', version: 'v1' },
    });
  });

  bench('getBaseUrl', () => {
    const client = createClient();
    client.getBaseUrl({});
  });

  bench('mergeRequestParams', () => {
    const client = createClient();
    asInternals(client).mergeRequestParams(
      { headers: { 'x-token': 'abc' } },
      { headers: { 'x-trace': '123' } },
    );
  });

  bench('request (json)', async () => {
    const client = createClient();
    await client.request({
      path: '/users',
      method: 'GET',
      format: 'json',
      query: { page: 1 },
    });
  });

  bench('request with body (json contentType)', async () => {
    const client = createClient();
    await client.request({
      path: '/users',
      method: 'POST',
      contentType: ContentType.Json,
      body: { name: 'John' },
      format: 'json',
    });
  });

  bench('toQueryString', () => {
    const client = createClient();
    asInternals(client).toQueryString({
      page: 1,
      tags: ['one', 'two'],
      filter: { status: 'active' },
    });
  });
});
