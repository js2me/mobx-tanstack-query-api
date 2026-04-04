# Vitest testing

Optional helpers for unit-testing code that uses [`HttpClient`](/http-client/index.html) and generated **endpoints**. They stub `HttpClient.request` or install short-lived client stubs around `endpoint.request`, so tests avoid the network while still receiving **`HttpResponse`** instances consistent with the runtime package.

::: tip Peer dependency
`vitest` is an **optional** peer dependency (`>=4`). Install it in your app and import helpers from the package subpath **`mobx-tanstack-query-api/vitest`** (this repository maps that path in `tsconfig` for local development).
:::

```ts
import {
  mockHttpClientRequestOnce,
  mockEndpointRequest,
} from 'mobx-tanstack-query-api/vitest';
```

## Shared concepts

### `MockHttpClientOutput`

Most HTTP-level mocks accept either **`{ success: data, status?, delay? }`** or **`{ error: err, status?, delay? }`**.

- **`success`** — the call resolves with an OK response and populated `data`. Default HTTP status is **200** if you omit `status`.
- **`error`** — the call is rejected the same way as a failing `HttpClient.request` (the rejection value is an **`HttpResponse`** with `error` set). Default status is **500** if you omit `status`.
- **`delay`** — optional wait in milliseconds before the mock runs (useful for loading states).

**Example — success then error:**

```ts
mockHttpClientRequestOnce(httpClient, { success: { id: 1 } });
mockHttpClientRequestOnce(httpClient, {
  error: { message: 'Not found' },
  status: 404,
});
```

### Shared `HttpClient` caveat

`mockHttpClientRequestOnce` stubs the **next** call to **`httpClient.request`**, not a specific URL. If several endpoints share one client, whichever request runs first consumes the stub. For **per-endpoint** control, prefer **`mockEndpointRequest`** / **`mockEndpointRequestOnce`** (or your own `fetch` mock).

---

## Low-level: `MockHttpResponse` and `createMockHttpResponse`

For advanced cases where you construct or inspect **`HttpResponse`** yourself.

### `MockHttpResponse`

A test-oriented subclass of runtime `HttpResponse`. Constructor options include request info (`requestParams`, etc.), optional `data` / `error` / `status`, and optional `httpClient` for URL building.

- Use **`setData`** / **`setError`** when you need to change payload or status after creation.
- **`createMockHttpResponse(params)`** is the async factory: it constructs a **`MockHttpResponse`** and awaits **`resolveBody`**, so `data` / `error` match ordinary client behavior before you use the instance.

**Example:**

```ts
import { createMockHttpResponse } from 'mobx-tanstack-query-api/vitest';

const response = await createMockHttpResponse({
  requestParams: { path: '/users', method: 'GET', format: 'json' },
  data: { name: 'Ada' },
});
expect(response.data).toEqual({ name: 'Ada' });
```

---

## `createMockHttpClientRequestHandler`

Builds the implementation function for **`vi.spyOn(httpClient, 'request').mockImplementation(...)`**: waits for optional `delay`, builds a mock **`HttpResponse`**, and applies your **`success`** or **`error`** payload (including default statuses). **`mockHttpClientRequest`** and **`mockHttpClientRequestOnce`** use this internally; call it directly only when you need a custom spy setup.

**Example:**

```ts
import { createMockHttpClientRequestHandler } from 'mobx-tanstack-query-api/vitest';
import { vi } from 'vitest';

const handler = createMockHttpClientRequestHandler(httpClient, {
  success: { ok: true },
});
const spy = vi.spyOn(httpClient, 'request').mockImplementation(handler);
// …run code under test…
spy.mockRestore();
```

---

## `mockHttpClientRequest` / `mockHttpClientRequestOnce`

```ts
function mockHttpClientRequest<TData, TError>(
  httpClient: HttpClient,
  output: MockHttpClientOutput<TData, TError>,
): MockInstance<HttpClient['request']>;

function mockHttpClientRequestOnce<TData, TError>(
  httpClient: HttpClient,
  output: MockHttpClientOutput<TData, TError>,
): MockInstance<HttpClient['request']>;
```

- **`mockHttpClientRequest`** — every `request` uses the same mock until you **`mockRestore()`** the returned spy.
- **`mockHttpClientRequestOnce`** — only the **next** `request` is mocked; later calls use the real implementation (e.g. real `fetch`).

Restore spies in **`afterEach`** (e.g. **`spy.mockRestore()`** or **`vi.restoreAllMocks()`**).

**Example — stub every call until restore:**

```ts
const spy = mockHttpClientRequest(httpClient, { success: { items: [] } });
const res = await httpClient.request({
  path: '/items',
  method: 'GET',
  format: 'json',
});
expect(res.data).toEqual({ items: [] });
spy.mockRestore();
```

**Example — only the next request:**

```ts
mockHttpClientRequestOnce(httpClient, { success: { id: 1 } });
// this call is mocked:
await httpClient.request({ path: '/x', method: 'GET', format: 'json' });
// following calls use the real client again
```

---

## `mockEndpointRequest` / `mockEndpointRequestOnce`

```ts
function mockEndpointRequest<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  output: MockHttpClientOutput<InferEndpointData<TEndpoint>['data'], InferEndpointData<TEndpoint>['error']>,
): MockInstance<TEndpoint['request']>;

function mockEndpointRequestOnce<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  output: MockHttpClientOutput<InferEndpointData<TEndpoint>['data'], InferEndpointData<TEndpoint>['error']>,
): MockInstance<TEndpoint['request']>;
```

These helpers spy on **`endpoint.request`**. On each matching call they register **`mockHttpClientRequestOnce`** on that endpoint’s **`httpClient`**, then invoke the real **`endpoint.request`** so your endpoint logic runs against the stubbed HTTP layer.

- **`mockEndpointRequest`** — every **`endpoint.request`** queues another one-time client stub with the same **`output`**.
- **`mockEndpointRequestOnce`** — only the **first** **`endpoint.request`** queues a stub; later calls use the real **`httpClient`** again (the spy falls back after one interception).

Both return a Vitest **`MockInstance`** for **`mockRestore()`** and assertions.

**Example — same response on every call:**

```ts
// `getUser` is your generated endpoint
const spy = mockEndpointRequest(getUser, { success: { name: 'Ann' } });
const r = await getUser.request({ id: 42 });
expect(r.data).toEqual({ name: 'Ann' });
spy.mockRestore();
```

**Example — first call only:**

```ts
mockEndpointRequestOnce(getUser, { success: { name: 'Once' } });
await getUser.request({ id: 1 }); // mocked
await getUser.request({ id: 2 }); // real HttpClient / fetch
```

---

## `mockEndpointRequestSequence`

```ts
function mockEndpointRequestSequence<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  outputs: MockHttpClientOutput<
    InferEndpointData<TEndpoint>['data'],
    InferEndpointData<TEndpoint>['error']
  >[],
): MockInstance<TEndpoint['request']>;
```

Each **`endpoint.request`** consumes the **next** item in **`outputs`** via a one-time client stub. If **`outputs`** is empty, or after the last item has been used, no stub is queued and the real client runs. Useful for flows such as “first call fails, second succeeds.”

**Example:**

```ts
const spy = mockEndpointRequestSequence(searchUsers, [
  { error: { code: 'TIMEOUT' }, status: 504 },
  { success: { users: [] } },
]);
await expect(searchUsers.request({ q: 'a' })).rejects.toMatchObject({
  status: 504,
});
await expect(searchUsers.request({ q: 'a' })).resolves.toMatchObject({
  data: { users: [] },
});
spy.mockRestore();
```

---

## `mockEndpointRequestWhen`

```ts
function mockEndpointRequestWhen<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  match: (params: InferEndpointInput<TEndpoint>) => boolean,
  output: MockHttpClientOutput<InferEndpointData<TEndpoint>['data'], InferEndpointData<TEndpoint>['error']>,
): MockInstance<TEndpoint['request']>;
```

If **`match(params)`** is true for a given call, that call queues a one-time client stub with **`output`**; otherwise the request runs without an extra stub. Use this for branching (for example, different behavior by id).

**Example:**

`getUser` here is any endpoint whose success `data` type includes **`tier`** (adjust the mock payload to match your generated types).

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

---

## `captureEndpointRequestParams`

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
void createItem.request({ body: { name: 'a' } });
const params = await nextParams;
expect(params.path).toContain('/items');
cap.restore();
```

---

## `stubEndpointThrow`

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
