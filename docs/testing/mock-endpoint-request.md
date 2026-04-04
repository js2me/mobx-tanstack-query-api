# `mockEndpointRequest`

```ts
function mockEndpointRequest<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  output: MockHttpClientOutput<InferEndpointData<TEndpoint>['data'], InferEndpointData<TEndpoint>['error']>,
): MockInstance<TEndpoint['request']>;
```

This helper spies on **`endpoint.request`**. On each matching call it registers **`mockHttpClientRequestOnce`** on that endpoint’s **`httpClient`**, then invokes the real **`endpoint.request`** so your endpoint logic runs against the stubbed HTTP layer.

**`mockEndpointRequest`** — every **`endpoint.request`** queues another one-time client stub with the same **`output`**.

Returns a Vitest **`MockInstance`** for **`mockRestore()`** and assertions.

**Example — same response on every call:**

```ts
// `getUser` is your generated endpoint
const spy = mockEndpointRequest(getUser, { success: { name: 'Ann' } });
const r = await getUser.request({ id: 42 });
expect(r.data).toEqual({ name: 'Ann' });
spy.mockRestore();
```
