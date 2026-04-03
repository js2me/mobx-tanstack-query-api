import './vitest-test-helpers.js';
import { describe, expect, it } from 'vitest';
import { isHttpResponse } from '../runtime/http-response.js';
import { mockHttpClientRequest } from './mock-http-client-request.js';
import {
  baseFullParams,
  createHttpClientWithGuardFetch,
} from './vitest-test-helpers.js';

describe('mockHttpClientRequest', () => {
  it('multiple calls receive the same success payload', async () => {
    const { httpClient, fetchMock } = createHttpClientWithGuardFetch();
    const spy = mockHttpClientRequest(httpClient, { success: { n: 2 } });
    await expect(
      httpClient.request<{ n: number }, null>(baseFullParams),
    ).resolves.toMatchObject({ data: { n: 2 } });
    await expect(
      httpClient.request<{ n: number }, null>({
        ...baseFullParams,
        path: '/other',
      }),
    ).resolves.toMatchObject({ data: { n: 2 } });
    expect(fetchMock).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('error is thrown on every call', async () => {
    const { httpClient } = createHttpClientWithGuardFetch();
    const spy = mockHttpClientRequest(httpClient, {
      error: { m: 'x' },
      status: 503,
    });
    await expect(httpClient.request(baseFullParams)).rejects.toSatisfy((e) =>
      isHttpResponse(e, 503),
    );
    await expect(httpClient.request(baseFullParams)).rejects.toSatisfy((e) =>
      isHttpResponse(e, 503),
    );
    spy.mockRestore();
  });

  it('mockRestore restores the real request', async () => {
    const { httpClient, fetchMock } = createHttpClientWithGuardFetch();
    const spy = mockHttpClientRequest(httpClient, { success: { a: 1 } });
    await httpClient.request(baseFullParams);
    spy.mockRestore();
    await expect(httpClient.request(baseFullParams)).rejects.toThrow(
      'fetch must not be called',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('status from output is reflected on the response', async () => {
    const { httpClient } = createHttpClientWithGuardFetch();
    const spy = mockHttpClientRequest(httpClient, {
      success: { ok: true },
      status: 204,
    });
    const r = await httpClient.request<{ ok: boolean }, null>({
      ...baseFullParams,
      method: 'DELETE',
    });
    expect(r.status).toBe(204);
    expect(r.ok).toBe(true);
    spy.mockRestore();
  });
});
