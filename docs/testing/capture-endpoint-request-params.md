# `captureEndpointRequestParams`

Records **`FullRequestParams`** from **`endpoint.configuration.params`** on each **`endpoint.request`**. It does **not** stub HTTP — pair with **`mockHttpClientRequestOnce`** (or similar) if the request should still resolve.

Returned handle: **`calls`**, **`last`**, **`waitNext()`**, **`withNextRequest(run)`**, **`restore()`**. Optional Vitest **`abortSignal`** for automatic cleanup on cancellation.

## `withNextRequest`

Calls **`run()`** (usually **`endpoint.request(...)`**), waits until params for that call are captured, then gives you **`{ params, result }`** when the request promise settles — so you can assert path/method/body and the **`HttpResponse`** without juggling **`Promise.all`**.

If **`request`** rejects, **`withNextRequest`** rejects too; **`params`** are still on **`calls`** / **`last`**. Use **`waitNext()`** + a separate promise, or **`expect(...).rejects`**, when you need that case.

**Example — assert built path and complete the request:**

`httpClient` must be the same instance your endpoint uses.

```ts
const cap = captureEndpointRequestParams(updateItem);
mockHttpClientRequestOnce(httpClient, { success: { ok: true } });

await updateItem.request({ id: 7, body: { title: 'x' } });

expect(cap.last?.path).toBe('/items/7');
expect(cap.last?.method).toBe('PATCH');
cap.restore();
```

**Example — `withNextRequest` (params + settled `request`):**

```ts
const cap = captureEndpointRequestParams(createItem);
mockHttpClientRequestOnce(httpClient, { success: { id: 1 } });

const { params, result } = await cap.withNextRequest(() =>
  createItem.request({ body: { name: 'a' } }),
);
expect(params.path).toContain('/items');
expect(result.data).toEqual({ id: 1 });
cap.restore();
```
