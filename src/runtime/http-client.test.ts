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

  it('request обрабатывает Response, выброшенный из fetch, как HttpResponse', async () => {
    const responseError = new Response(
      JSON.stringify({ message: 'from throw' }),
      {
        status: 429,
      },
    );
    const fetchMock = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(responseError);

    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      fetch: fetchMock,
    });

    let thrown: unknown;
    try {
      await client.request<{ ok: boolean }, { message: string }>({
        path: '/users',
        method: 'GET',
        format: 'json',
      });
    } catch (error) {
      thrown = error;
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(thrown).toBeDefined();
    expect(isHttpResponse(thrown, 429)).toBe(true);
    expect(client.badResponse).toBe(thrown);
  });

  it('request пробрасывает не-Response ошибку из fetch без изменений', async () => {
    const networkError = new TypeError('Network failed');
    const fetchMock = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(networkError);

    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      fetch: fetchMock,
    });

    let thrown: unknown;
    try {
      await client.request({
        path: '/users',
        method: 'GET',
      });
    } catch (error) {
      thrown = error;
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(thrown).toBe(networkError);
    expect(client.badResponse).toBeNull();
  });
});
