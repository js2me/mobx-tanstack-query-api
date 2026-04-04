# `stubEndpointThrow`

```ts
function stubEndpointThrow<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  error: unknown | (() => unknown) | (() => Promise<unknown>),
  options?: { persistent?: boolean },
): MockInstance<TEndpoint['request']>;
```

Makes **`endpoint.request`** reject with an arbitrary value (not necessarily an **`HttpResponse`**). **`error`** may be a plain value or a function (sync or async) that produces the thrown value. With **`persistent: true`**, every call uses **`mockImplementation`** and always throws; otherwise **`mockImplementationOnce`** applies, so only the first call throws and later calls use the real implementation again.

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
