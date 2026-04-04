# `mockHttpClientRequestSequence`

Each **`httpClient.request`** takes the **next** mock from **`outputs`**; when the list is done, the real client runs.

Order is **per client**, not per endpoint: any code that calls **`request`** on that client advances the queue. For per-endpoint sequences use **`mockEndpointRequestSequence`**.

**Example — same endpoint, fail then succeed:**

```ts
const spy = mockHttpClientRequestSequence(httpClient, [
  { error: { code: 'TIMEOUT' }, status: 504 },
  { success: { users: [] } },
]);
await expect(searchUsers.request({ q: 'a' })).rejects.toMatchObject({
  status: 504,
});
await expect(searchUsers.request({ q: 'a' })).resolves.toMatchObject({
  data: { users: [] },
});
spy.mockRestore();
```
