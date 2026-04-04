# `mockEndpointRequestSequence`

```ts
function mockEndpointRequestSequence<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  outputs: MockHttpClientOutput<
    InferEndpointData<TEndpoint>['data'],
    InferEndpointData<TEndpoint>['error']
  >[],
): MockInstance<TEndpoint['request']>;
```

Each **`endpoint.request`** consumes the **next** item in **`outputs`** via a one-time client stub. If **`outputs`** is empty, or after the last item has been used, no stub is queued and the real client runs. Useful for flows such as “first call fails, second succeeds.”

To consume mocks in **HTTP client call order** when several endpoints share one **`HttpClient`**, use **`mockHttpClientRequestSequence`** instead.

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
