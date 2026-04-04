# `mockEndpointRequestWhen`

```ts
function mockEndpointRequestWhen<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  match: (params: InferEndpointInput<TEndpoint>) => boolean,
  output: MockHttpClientOutput<InferEndpointData<TEndpoint>['data'], InferEndpointData<TEndpoint>['error']>,
): MockInstance<TEndpoint['request']>;
```

If **`match(params)`** is true for a given call, that call queues a one-time client stub with **`output`**; otherwise the request runs without an extra stub. Use this for branching (for example, different behavior by id).

**Example:**

`getUser` here is any endpoint whose success `data` type includes **`tier`** (adjust the mock payload to match your generated types).

```ts
const spy = mockEndpointRequestWhen(
  getUser,
  (p) => p.id >= 1000,
  { success: { tier: 'vip' } },
);
// id 1 → real client; id 1000 → mocked VIP payload
await getUser.request({ id: 1 });
await getUser.request({ id: 1000 });
spy.mockRestore();
```
