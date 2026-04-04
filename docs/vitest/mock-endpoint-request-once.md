# `mockEndpointRequestOnce`

```ts
function mockEndpointRequestOnce<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  output: MockHttpClientOutput<InferEndpointData<TEndpoint>['data'], InferEndpointData<TEndpoint>['error']>,
): MockInstance<TEndpoint['request']>;
```

This helper spies on **`endpoint.request`**. On the first call it registers **`mockHttpClientRequestOnce`** on that endpoint’s **`httpClient`**, then invokes the real **`endpoint.request`** so your endpoint logic runs against the stubbed HTTP layer.

**`mockEndpointRequestOnce`** — only the **first** **`endpoint.request`** queues a stub; later calls use the real **`httpClient`** again (the spy falls back after one interception).

Returns a Vitest **`MockInstance`** for **`mockRestore()`** and assertions.

**Example — first call only:**

```ts
mockEndpointRequestOnce(getUser, { success: { name: 'Once' } });
await getUser.request({ id: 1 }); // mocked
await getUser.request({ id: 2 }); // real HttpClient / fetch
```
