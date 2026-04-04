# `mockHttpClientRequest`

Stubs **`httpClient.request`** with the same **`output`** on every call until you **`mockRestore()`** the returned spy (often in **`afterEach`**).

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
