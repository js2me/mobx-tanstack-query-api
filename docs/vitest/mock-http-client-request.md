# `mockHttpClientRequest`

```ts
function mockHttpClientRequest<TData, TError>(
  httpClient: HttpClient,
  output: MockHttpClientOutput<TData, TError>,
): MockInstance<HttpClient['request']>;
```

Every **`httpClient.request`** uses the same mock until you **`mockRestore()`** the returned spy.

Restore spies in **`afterEach`** (e.g. **`spy.mockRestore()`** or **`vi.restoreAllMocks()`**).

**Example — stub every call until restore:**

```ts
const spy = mockHttpClientRequest(httpClient, { success: { items: [] } });
const res = await httpClient.request({
  path: '/items',
  method: 'GET',
  format: 'json',
});
expect(res.data).toEqual({ items: [] });
spy.mockRestore();
```
