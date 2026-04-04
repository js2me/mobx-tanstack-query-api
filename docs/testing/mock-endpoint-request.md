# `mockEndpointRequest`

Spies on **`endpoint.request`**. Each call queues a one-time stub on that endpoint’s **`httpClient`**, then runs the real **`endpoint.request`** so endpoint code still executes against mocked HTTP.

Every call reuses the same **`output`** until you **`mockRestore()`** the returned Vitest spy.

**Example — same response on every call:**

```ts
// `getUser` is your generated endpoint
const spy = mockEndpointRequest(getUser, { success: { name: 'Ann' } });
const r = await getUser.request({ id: 42 });
expect(r.data).toEqual({ name: 'Ann' });
spy.mockRestore();
```
