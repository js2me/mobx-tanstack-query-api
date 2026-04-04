import './vitest-test-helpers.js';
import { describe, expect, it } from 'vitest';
import { Endpoint } from '../runtime/endpoint.js';
import { EndpointQueryClient } from '../runtime/endpoint-query-client.js';
import { HttpClient } from '../runtime/http-client.js';
import type { HttpResponse } from '../runtime/http-response.js';
import { mswPathPattern } from './msw-path-pattern.js';
import { createTestEndpoint } from './vitest-test-helpers.js';

describe('mswPathPattern', () => {
  it('baseUrl and {id} segment become :id', () => {
    const queryClient = new EndpointQueryClient();
    const { endpoint } = createTestEndpoint({ queryClient });
    expect(mswPathPattern(endpoint)).toBe('https://api.test/items/:id');
  });

  it('empty baseUrl yields leading slash pathname', () => {
    const queryClient = new EndpointQueryClient();
    const httpClient = new HttpClient({ baseUrl: '' });
    const endpoint = new Endpoint<
      HttpResponse<unknown, null, number>,
      { id: number },
      Record<string, never>
    >(
      {
        params: ({ id }) => ({
          path: `/x/${id}`,
          method: 'GET',
          format: 'json',
        }),
        requiredParams: ['id'],
        operationId: 'x',
        path: ['x', '{id}'],
        tags: [],
        meta: {},
      },
      queryClient,
      httpClient,
    );
    expect(mswPathPattern(endpoint)).toBe('/x/:id');
  });

  it('trims baseUrl slashes and avoids double slashes', () => {
    const queryClient = new EndpointQueryClient();
    const httpClient = new HttpClient({
      baseUrl: 'https://api.example.com/',
    });
    const endpoint = new Endpoint<
      HttpResponse<unknown, null, number>,
      Record<string, never>,
      Record<string, never>
    >(
      {
        params: () => ({
          path: '/status',
          method: 'GET',
          format: 'json',
        }),
        requiredParams: [],
        operationId: 'status',
        path: ['status'],
        tags: [],
        meta: {},
      },
      queryClient,
      httpClient,
    );
    expect(mswPathPattern(endpoint)).toBe('https://api.example.com/status');
  });
});
