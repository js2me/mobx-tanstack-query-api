# `mockEndpointRequestOnce`

Like [`mockEndpointRequest`](./mock-endpoint-request.html), but only the **first** **`endpoint.request`** is stubbed; later calls hit the real **`httpClient`**.

Returns a Vitest spy — call **`mockRestore()`** when done.

**Example — first call only:**

```ts
mockEndpointRequestOnce(getUser, { success: { name: 'Once' } });
await getUser.request({ id: 1 }); // mocked
await getUser.request({ id: 2 }); // real HttpClient / fetch
```
