# `captureEndpointRequestParams`

```ts
function captureEndpointRequestParams<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  abortSignal?: AbortSignal,
): CaptureEndpointRequestParamsHandle<TEndpoint>;
```

Records the **`FullRequestParams`** produced by **`endpoint.configuration.params`** for each **`endpoint.request`**. It does **not** mock **`HttpClient`**; pair it with **`mockHttpClientRequestOnce`** (or your own **`fetch`** stub) if the call should still complete.

Optional **`abortSignal`**: pass Vitest’s test **`signal`** (from **`it(..., ({ signal }) => { ... })`**) so **`restore()`** runs automatically when the test is **cancelled** (aborted signal). **`restore()`** is idempotent if you still call it at the end of a normal run.

The handle exposes **`calls`**, **`last`**, **`waitNext()`**, **`withNextRequest(run)`**, **`spy`**, and **`restore()`** (**`spy.mockRestore()`**, safe to call multiple times).

## `withNextRequest`

```ts
withNextRequest(
  run: () => ReturnType<TEndpoint["request"]>,
): Promise<{
  params: FullRequestParams;
  result: Awaited<ReturnType<TEndpoint["request"]>>;
}>;
```

Registers a **`waitNext`** waiter, then calls **`run()`** (typically **`endpoint.request(...)`**). Waits until **`params`** for that call are recorded, then awaits the promise **`run()`** returned. You get **`params`** (path, method, body, …) and **`result`** (the fulfilled value of that promise — for generated endpoints usually **`HttpResponse`**) without **`Promise.all`** / **`queueMicrotask`**.

Use **`waitNext()`** when you want the raw **`request`** promise (e.g. **`expect(p).rejects`**). If **`withNextRequest`** rejects because **`request`** failed, you do not get a return value — **`params`** are still on **`cap.calls`** / **`cap.last`**; use **`await expect(cap.withNextRequest(…)).rejects…`** or **`waitNext()`** + a separate **`request`** promise.

**Example — assert built path and complete the request:**

`httpClient` here must be the same instance passed into your endpoint constructor.

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

If **`request`** rejects, **`withNextRequest`** rejects too (after **`params`** are already on **`cap.calls`** / **`cap.last`**). Use **`await expect(cap.withNextRequest(() => endpoint.request(…))).rejects…`** or fall back to **`waitNext()`**.
