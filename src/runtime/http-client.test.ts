import { describe, expect, it, vi } from 'vitest';
import { ContentType, HttpClient } from './http-client.js';
import { isHttpResponse } from './http-response.js';

describe('HttpClient', () => {
  it('request возвращает успешный HttpResponse с распарсенным data', async () => {
    const fetchMock = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 1 }), { status: 200 }),
      );

    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      fetch: fetchMock,
    });

    const response = await client.request<{ id: number }, { message: string }>({
      path: '/users',
      method: 'GET',
      format: 'json',
      query: { page: 1 },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.example.com/users?page=1',
    );
    expect(response.ok).toBe(true);
    expect(response.data).toEqual({ id: 1 });
    expect(response.error).toBeNull();
    expect(client.badResponse).toBeNull();
  });

  it('request на не-ok сохраняет badResponse и кидает HttpResponse', async () => {
    const fetchMock = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: 'fail' }), { status: 400 }),
      );

    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      fetch: fetchMock,
    });

    let thrown: unknown;
    try {
      await client.request<{ ok: boolean }, { message: string }>({
        path: '/users',
        method: 'POST',
        contentType: ContentType.Json,
        body: { name: 'John' },
        format: 'json',
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeDefined();
    expect(isHttpResponse(thrown, 400)).toBe(true);
    expect(client.badResponse).toBe(thrown);

    const fetchParams = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = fetchParams.headers as Headers;

    expect(headers.get('Content-Type')).toBe(ContentType.Json);
    expect(fetchParams.body).toBe(JSON.stringify({ name: 'John' }));
  });
});
