# `mockEndpointRequestWhen`

When **`match(params)`** returns true, that **`endpoint.request`** call gets a one-time stub with **`output`**; otherwise the request is unchanged. Use this for branching (e.g. different users or ids).

**Example** — `getUser` should expose a **`tier`** field in its success type if you mock `{ tier: 'vip' }`.

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
