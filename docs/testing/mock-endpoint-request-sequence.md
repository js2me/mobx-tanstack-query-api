# `mockEndpointRequestSequence`

Each **`endpoint.request`** uses the **next** entry in **`outputs`** (one-time stub per call). After the list is exhausted, the real client runs again — handy for “fail once, then succeed” flows.

If several endpoints share one **`HttpClient`** and you care about **call order across endpoints**, use **`mockHttpClientRequestSequence`** instead.

**Example:**

```ts
const spy = mockEndpointRequestSequence(searchUsers, [
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
