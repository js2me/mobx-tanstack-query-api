# `stubEndpointThrow`

Forces **`endpoint.request`** to **reject** with a value you provide (not necessarily an **`HttpResponse`**). **`error`** can be a value or a function (sync/async) that returns the rejection.

- Default: **`mockImplementationOnce`** — only the first call throws, then the real **`request`** runs again.
- **`persistent: true`**: every call throws (pass it in the **third** argument together with any other options).

Optional **`abortSignal`** goes in that same options object, e.g. **`{ abortSignal: signal }`** from Vitest’s test context — the spy is restored when the test is cancelled. You still call **`spy.mockRestore()`** yourself in a normal teardown; that stays safe.

**Example — one failure, then real behavior:**

```ts
const spy = stubEndpointThrow(deleteItem, new Error('offline'));
await expect(deleteItem.request({ id: 1 })).rejects.toThrow('offline');
await deleteItem.request({ id: 2 }); // uses real client again
spy.mockRestore();
```

**Example — every call throws:**

```ts
const spy = stubEndpointThrow(deleteItem, () => new Error('forbidden'), {
  persistent: true,
});
await expect(deleteItem.request({ id: 1 })).rejects.toThrow('forbidden');
await expect(deleteItem.request({ id: 2 })).rejects.toThrow('forbidden');
spy.mockRestore();
```
