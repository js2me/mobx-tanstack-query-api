import './vitest-test-helpers.js';
import { describe, expect, it, vi } from 'vitest';
import { isHttpResponse } from '../runtime/http-response.js';
import { mockEndpointRequest } from './mock-endpoint-request.js';
import { createTestEndpoint } from './vitest-test-helpers.js';

describe('mockEndpointRequest', () => {
  it('multiple endpoint.request calls with one mock', async () => {
    const { endpoint, fetchMock } = createTestEndpoint();
    const spy = mockEndpointRequest(endpoint, { success: { value: 'multi' } });
    await expect(endpoint.request({ id: 1 })).resolves.toMatchObject({
      data: { value: 'multi' },
    });
    await expect(endpoint.request({ id: 2 })).resolves.toMatchObject({
      data: { value: 'multi' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('repeated error on each call', async () => {
    const { endpoint } = createTestEndpoint();
    const spy = mockEndpointRequest(endpoint, {
      error: { code: 'n' },
      status: 418,
    });
    await expect(endpoint.request({ id: 1 })).rejects.toSatisfy((e) =>
      isHttpResponse(e, 418),
    );
    await expect(endpoint.request({ id: 1 })).rejects.toSatisfy((e) =>
      isHttpResponse(e, 418),
    );
    spy.mockRestore();
  });

  it('after vi.restoreAllMocks fetch is invoked again', async () => {
    const { endpoint, fetchMock } = createTestEndpoint();
    mockEndpointRequest(endpoint, { success: { value: 'x' } });
    await endpoint.request({ id: 1 });
    vi.restoreAllMocks();
    await expect(endpoint.request({ id: 2 })).rejects.toThrow(
      'fetch must not be called',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('custom status on success', async () => {
    const { endpoint, fetchMock } = createTestEndpoint();
    const spy = mockEndpointRequest(endpoint, {
      success: { value: 'created' },
      status: 201,
    });
    const r = await endpoint.request({ id: 7 });
    expect(r.status).toBe(201);
    expect(r.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
