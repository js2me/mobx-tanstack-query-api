# `captureEndpointRequestParams`

```ts
function captureEndpointRequestParams<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
): CaptureEndpointRequestParamsHandle<TEndpoint>;
```

Records the **`FullRequestParams`** produced by **`endpoint.configuration.params`** for each **`endpoint.request`**. It does **not** mock **`HttpClient`**; pair it with **`mockHttpClientRequestOnce`** (or your own **`fetch`** stub) if the call should still complete.

The handle exposes **`calls`** (every recorded params object), **`last`** (the most recent), **`waitNext()`** (a promise that resolves with the params from the **next** request), **`spy`**, and **`restore()`** (calls **`spy.mockRestore()`**).

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

**Example — wait for the next call:**

```ts
const cap = captureEndpointRequestParams(createItem);
mockHttpClientRequestOnce(httpClient, { success: { id: 1 } });
const nextParams = cap.waitNext();
createItem.request({ body: { name: 'a' } });
const params = await nextParams;
expect(params.path).toContain('/items');
cap.restore();
```
