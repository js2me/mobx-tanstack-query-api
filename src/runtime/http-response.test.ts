import { describe, expect, it } from 'vitest';
import { HttpResponse } from './http-response.js';

const createRequestInfo = () => ({
  url: 'https://example.com/api',
  params: { method: 'GET' } satisfies RequestInit,
});

describe('HttpResponse', () => {
  it('isEmpty корректно определяет пустые и непустые ответы', () => {
    const request = createRequestInfo();

    const noContentResponse = new HttpResponse(
      new Response(null, { status: 204 }),
      request,
    );
    const nullBodyResponse = new HttpResponse(
      new Response(null, { status: 200 }),
      request,
    );
    const textResponse = new HttpResponse(
      new Response('payload', { status: 200 }),
      request,
    );

    expect(noContentResponse.isEmpty()).toBe(true);
    expect(nullBodyResponse.isEmpty()).toBe(true);
    expect(textResponse.isEmpty()).toBe(false);
  });

  it('resolveBody записывает данные в data для ok и в error для не-ok', async () => {
    const request = createRequestInfo();

    const okResponse = new HttpResponse<{ ok: boolean }, { message: string }>(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
      request,
    );
    await okResponse.resolveBody('json');

    expect(okResponse.data).toEqual({ ok: true });
    expect(okResponse.error).toBeNull();

    const badResponse = new HttpResponse<{ ok: boolean }, { message: string }>(
      new Response(JSON.stringify({ message: 'fail' }), { status: 400 }),
      request,
    );
    await badResponse.resolveBody('json');

    expect(badResponse.data).toBeNull();
    expect(badResponse.error).toEqual({ message: 'fail' });
  });

  it("isEmpty бросает Cannot read properties of undefined (reading 'get') при отсутствии headers", () => {
    const request = createRequestInfo();
    const invalidResponseLike = {
      headers: undefined,
      ok: false,
      body: null,
      redirected: false,
      status: 500,
      statusText: 'Internal Server Error',
      type: 'basic',
      url: request.url,
      clone: () => invalidResponseLike,
    } as unknown as Response;

    const response = new HttpResponse(invalidResponseLike, request);

    expect(response.isEmpty()).toBe(true);
  });
});
