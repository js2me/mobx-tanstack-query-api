import './vitest-test-helpers.js';
import { describe, expect, it, vi } from 'vitest';
import { isHttpResponse } from '../runtime/http-response.js';
import { mockHttpClientRequestOnce } from './mock-http-client-request-once.js';
import {
  baseFullParams,
  createHttpClientWithGuardFetch,
} from './vitest-test-helpers.js';

describe('mockHttpClientRequestOnce', () => {
  it('success returns HttpResponse with data', async () => {
    const { httpClient, fetchMock } = createHttpClientWithGuardFetch();
    mockHttpClientRequestOnce(httpClient, {
      success: { x: 1 },
      status: 200,
    });
    const r = await httpClient.request<{ x: number }, null>(baseFullParams);
    expect(r.data).toEqual({ x: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('error throws HttpResponse', async () => {
    const { httpClient } = createHttpClientWithGuardFetch();
    mockHttpClientRequestOnce(httpClient, {
      error: { code: 'bad' },
      status: 400,
    });
    await expect(
      httpClient.request<{ ok: true }, { code: string }>(baseFullParams),
    ).rejects.toSatisfy(
      (e) => isHttpResponse(e, 400) && e.error?.code === 'bad',
    );
  });

  it('second call uses the real request and hits fetch', async () => {
    const { httpClient, fetchMock } = createHttpClientWithGuardFetch();
    mockHttpClientRequestOnce(httpClient, { success: { once: true } });
    await httpClient.request(baseFullParams);
    await expect(httpClient.request(baseFullParams)).rejects.toThrow(
      'fetch must not be called',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('delay defers the response (fake timers)', async () => {
    vi.useFakeTimers();
    const { httpClient } = createHttpClientWithGuardFetch();
    mockHttpClientRequestOnce(httpClient, { success: { d: 1 }, delay: 500 });
    const p = httpClient.request<{ d: number }, null>(baseFullParams);
    await vi.advanceTimersByTimeAsync(499);
    let settled = false;
    p.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toMatchObject({ data: { d: 1 } });
  });
});
