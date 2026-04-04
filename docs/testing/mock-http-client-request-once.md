# `mockHttpClientRequestOnce`

```ts
function mockHttpClientRequestOnce<TData, TError>(
  httpClient: HttpClient,
  output: MockHttpClientOutput<TData, TError>,
): MockInstance<HttpClient['request']>;
```

Only the **next** **`httpClient.request`** is mocked; later calls use the real implementation (e.g. real **`fetch`**).

`mockHttpClientRequestOnce` stubs the **next** call to **`httpClient.request`**, not a specific URL. If several endpoints share one client, whichever request runs first consumes the stub. For **per-endpoint** control, prefer **`mockEndpointRequest`** / **`mockEndpointRequestOnce`** (or your own **`fetch`** mock).

Restore spies in **`afterEach`** (e.g. **`spy.mockRestore()`** or **`vi.restoreAllMocks()`**).

**Example — only the next request:**

```ts
mockHttpClientRequestOnce(httpClient, { success: { id: 1 } });
// this call is mocked:
await httpClient.request({ path: '/x', method: 'GET', format: 'json' });
// following calls use the real client again
```
