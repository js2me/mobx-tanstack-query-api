# `mockHttpClientRequestSequence`

```ts
function mockHttpClientRequestSequence<TData, TError>(
  httpClient: HttpClient,
  outputs: MockHttpClientOutput<TData, TError>[],
): MockInstance<HttpClient['request']>;
```

Each **`httpClient.request`** consumes the **next** item in **`outputs`**. If **`outputs`** is empty, or after the last item has been used, the real client runs (e.g. **`fetch`**).

Unlike **`mockEndpointRequestSequence`**, ordering is global for that client: whichever code path calls **`request`** first gets the first mock, even if another endpoint triggers it.

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
