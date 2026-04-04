# `mockHttpClientRequestOnce`

Only the **next** **`httpClient.request`** is mocked; the stub is not tied to a specific URL — the first matching call wins. If many endpoints share one client, prefer the **`mockEndpointRequest*`** helpers for clearer scoping.

Restore the spy in **`afterEach`** when you are finished.

**Example — only the next request:**

```ts
mockHttpClientRequestOnce(httpClient, { success: { id: 1 } });
// this call is mocked:
await httpClient.request({ path: '/x', method: 'GET', format: 'json' });
// following calls use the real client again
```
