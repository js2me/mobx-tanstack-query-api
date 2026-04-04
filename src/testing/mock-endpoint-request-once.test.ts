import './vitest-test-helpers.js';
import { describe, expect, it, vi } from 'vitest';
import { EndpointQueryClient } from '../runtime/endpoint-query-client.js';
import { isHttpResponse } from '../runtime/http-response.js';
import { mockEndpointRequestOnce } from './mock-endpoint-request-once.js';
import {
  createTestEndpoint,
  createThreeEndpointsOnSharedClient,
} from './vitest-test-helpers.js';

describe('mockEndpointRequestOnce', () => {
  it('success: endpoint.request returns data', async () => {
    const queryClient = new EndpointQueryClient();
    const { endpoint, fetchMock } = createTestEndpoint({ queryClient });
    mockEndpointRequestOnce(endpoint, { success: { value: 'ok' } });
    const r = await endpoint.request({ id: 1 });
    expect(r.data).toEqual({ value: 'ok' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('error: endpoint.request throws HttpResponse', async () => {
    const queryClient = new EndpointQueryClient();
    const { endpoint, fetchMock } = createTestEndpoint({ queryClient });
    mockEndpointRequestOnce(endpoint, {
      error: { code: 'e' },
      status: 409,
    });
    await expect(endpoint.request({ id: 2 })).rejects.toSatisfy((e) =>
      isHttpResponse(e, 409),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('second endpoint.request does not use the client mock', async () => {
    const queryClient = new EndpointQueryClient();
    const { endpoint, fetchMock } = createTestEndpoint({ queryClient });
    mockEndpointRequestOnce(endpoint, { success: { value: 'one' } });
    await endpoint.request({ id: 1 });
    await expect(endpoint.request({ id: 2 })).rejects.toThrow(
      'fetch must not be called',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('delay is applied before the response', async () => {
    vi.useFakeTimers();
    const queryClient = new EndpointQueryClient();
    const { endpoint, fetchMock } = createTestEndpoint({ queryClient });
    mockEndpointRequestOnce(endpoint, { success: { value: 't' }, delay: 300 });
    const p = endpoint.request({ id: 1 });
    await vi.advanceTimersByTimeAsync(299);
    let done = false;
    p.then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toMatchObject({ data: { value: 't' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('seven mockEndpointRequestOnce on three endpoints with shared HttpClient (sequentially: mock then call)', async () => {
    const { endpointA, endpointB, endpointC, fetchMock } =
      createThreeEndpointsOnSharedClient();

    mockEndpointRequestOnce(endpointA, { success: { value: 'a-1' } });
    await expect(endpointA.request({ id: 1 })).resolves.toMatchObject({
      data: { value: 'a-1' },
    });

    mockEndpointRequestOnce(endpointB, { success: { value: 'b-1' } });
    await expect(endpointB.request({ id: 10 })).resolves.toMatchObject({
      data: { value: 'b-1' },
    });

    mockEndpointRequestOnce(endpointC, { success: { value: 'c-1' } });
    await expect(endpointC.request({ id: 20 })).resolves.toMatchObject({
      data: { value: 'c-1' },
    });

    mockEndpointRequestOnce(endpointA, { success: { value: 'a-2' } });
    await expect(endpointA.request({ id: 2 })).resolves.toMatchObject({
      data: { value: 'a-2' },
    });

    mockEndpointRequestOnce(endpointB, { success: { value: 'b-2' } });
    await expect(endpointB.request({ id: 11 })).resolves.toMatchObject({
      data: { value: 'b-2' },
    });

    mockEndpointRequestOnce(endpointC, {
      error: { code: 'c-err' },
      status: 422,
    });
    await expect(endpointC.request({ id: 21 })).rejects.toSatisfy((e) =>
      isHttpResponse(e, 422),
    );

    mockEndpointRequestOnce(endpointA, { success: { value: 'a-3' } });
    await expect(endpointA.request({ id: 3 })).resolves.toMatchObject({
      data: { value: 'a-3' },
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
