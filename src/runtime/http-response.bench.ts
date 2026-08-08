import { bench, describe } from 'vitest';
import {
  HttpResponse,
  isHttpBadResponse,
  isHttpResponse,
} from './http-response.js';

const createResponse = (init?: ResponseInit) =>
  new HttpResponse(
    new Response(JSON.stringify({ id: 1 }), { status: 200, ...init }),
    { url: 'https://api.example.com/users', params: {} },
  );

const createEmptyResponse = () =>
  new HttpResponse(new Response(null, { status: 204 }), {
    url: 'https://api.example.com/users',
    params: {},
  });

describe('HttpResponse', () => {
  bench('create HttpResponse', () => {
    createResponse();
  });

  bench('isEmpty', () => {
    createResponse().isEmpty();
  });

  bench('isEmpty with 204 status', () => {
    createEmptyResponse().isEmpty();
  });

  bench('clone', () => {
    createResponse().clone();
  });

  bench('resolveBody (json)', async () => {
    const response = createResponse();
    await response.resolveBody('json');
  });

  bench('isHttpResponse', () => {
    const response = createResponse();
    isHttpResponse(response);
    isHttpResponse(response, 200);
    isHttpResponse({ data: null });
    isHttpResponse(null);
  });

  bench('isHttpBadResponse', () => {
    const response = createResponse({ status: 400 });
    isHttpBadResponse(response);
    isHttpBadResponse(response, 400);
  });
});
