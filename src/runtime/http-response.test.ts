import { describe, expect, expectTypeOf, it } from 'vitest';
import type { HttpMultistatusResponse } from './http-response.js';
import {
  HttpResponse,
  isHttpBadResponse,
  isHttpResponse,
} from './http-response.js';

const createRequestInfo = () => ({
  url: 'https://example.com/api',
  params: { method: 'GET' } satisfies RequestInit,
});

describe('HttpResponse', () => {
  it('isEmpty correctly classifies empty and non-empty responses', () => {
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

  it('resolveBody writes payload to data for ok and to error for non-ok', async () => {
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

  it("isEmpty throws Cannot read properties of undefined (reading 'get') when headers are missing", () => {
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

  it('isHttpResponse narrows data, error and status with generics', async () => {
    type UserData = { id: number };
    type UserError = { message: string };
    const request = createRequestInfo();

    const badResponse = new HttpResponse<UserData, UserError, 422>(
      new Response(JSON.stringify({ message: 'Validation failed' }), {
        status: 422,
      }),
      request,
    );
    await badResponse.resolveBody('json');

    const unknownResponse: unknown = badResponse;

    expect(isHttpResponse<UserData, UserError, 422>(unknownResponse, 422)).toBe(
      true,
    );

    if (isHttpResponse<UserData, UserError, 422>(unknownResponse, 422)) {
      expectTypeOf(unknownResponse.data).toEqualTypeOf<UserData>();
      expectTypeOf(unknownResponse.error).toEqualTypeOf<UserError>();
      expectTypeOf(unknownResponse.status).toEqualTypeOf<422>();
      expect(unknownResponse.error).toEqual({ message: 'Validation failed' });
    }
  });

  it('isHttpResponse works with HttpMultistatusResponse status extracts', async () => {
    type MultiResponse = HttpMultistatusResponse<
      {
        200: { id: number };
        409: { code: 'conflict' };
      },
      { id: number },
      { message: string }
    >;
    type ConflictResponse = Extract<MultiResponse, { status: 409 }>;
    const request = createRequestInfo();

    const testMultiResponse = null as any as ConflictResponse;

    const conflict = new HttpResponse<
      ConflictResponse['data'],
      ConflictResponse['error'],
      409
    >(
      new Response(JSON.stringify({ code: 'conflict' }), {
        status: 409,
      }),
      request,
    );
    await conflict.resolveBody('json');

    const unknownResponse: unknown = conflict;

    expect(
      isHttpResponse<ConflictResponse['data'], ConflictResponse['error'], 409>(
        unknownResponse,
        409,
      ),
    ).toBe(true);
    if (isHttpResponse(unknownResponse, 409)) {
      expectTypeOf(unknownResponse).toEqualTypeOf<
        HttpResponse<any, any, 409>
      >();
    }
    if (isHttpResponse(testMultiResponse, 409)) {
      expectTypeOf(testMultiResponse).toEqualTypeOf<
        HttpResponse<
          {
            id: number;
          },
          {
            code: 'conflict';
          },
          409
        >
      >();
    }
    expect(
      isHttpResponse<ConflictResponse['data'], ConflictResponse['error'], 200>(
        unknownResponse,
        200,
      ),
    ).toBe(false);

    if (
      isHttpResponse<ConflictResponse['data'], ConflictResponse['error'], 409>(
        unknownResponse,
        409,
      )
    ) {
      expectTypeOf(unknownResponse.error).toEqualTypeOf<
        ConflictResponse['error']
      >();
      expectTypeOf(unknownResponse.status).toEqualTypeOf<409>();
      expect(unknownResponse.error).toEqual({ code: 'conflict' });
    }
  });

  it('isHttpBadResponse narrows error and status with generics', async () => {
    type ValidationError = { message: string };
    const request = createRequestInfo();

    const badResponse = new HttpResponse<null, ValidationError, 400>(
      new Response(JSON.stringify({ message: 'bad request' }), {
        status: 400,
      }),
      request,
    );
    await badResponse.resolveBody('json');

    const unknownResponse: unknown = badResponse;

    expect(isHttpBadResponse<ValidationError, 400>(unknownResponse, 400)).toBe(
      true,
    );
    expect(isHttpBadResponse<ValidationError, 404>(unknownResponse, 404)).toBe(
      false,
    );

    if (isHttpBadResponse<ValidationError, 400>(unknownResponse, 400)) {
      expectTypeOf(unknownResponse.data).toEqualTypeOf<null>();
      expectTypeOf(unknownResponse.error).toEqualTypeOf<ValidationError>();
      expectTypeOf(unknownResponse.status).toEqualTypeOf<400>();
      expect(unknownResponse.error).toEqual({ message: 'bad request' });
    }
  });
});
