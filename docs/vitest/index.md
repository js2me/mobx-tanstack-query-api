# Vitest testing

Optional helpers for unit-testing code that uses [`HttpClient`](/http-client/index.html) and generated **endpoints**. They stub `HttpClient.request` (or wrap `endpoint.request`) so tests do not need a real network, while responses behave like real **`HttpResponse`** instances from the main package.

::: tip Peer dependency
`vitest` is an **optional** peer dependency (`>=4`). Install it in your project and import helpers from **`mobx-tanstack-query-api/vitest`** (same as in this repo’s `tsconfig` paths).
:::

::: tip Examples in the repo
The runnable snippets below are covered by **`src/vitest/docs-examples.test.ts`** — update that file when you change examples here.
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

- **`success`** — the request resolves as OK; you get `data` on the response. Default status **200** if you omit `status`.
- **`error`** — the request fails the same way as a failed `HttpClient` call (promise rejects with that response). Default status **500** if you omit `status`.
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

### Edge case: falsy `data` / `error`

If you need a body that is **`0`**, **`''`**, or **`false`**, the low-level mock response helpers may not pick it up the same way as “normal” values. In those rare cases, build or adjust the mock response with **`setData`** / **`setError`** after creation (see low-level section below).

---

## Low-level: `MockHttpResponse` and `createMockHttpResponse`

For advanced cases where you construct or inspect **`HttpResponse`** yourself.

### `MockHttpResponse`

A test-oriented subclass of runtime `HttpResponse`. You pass constructor options such as request info, optional `data` / `error` / `status`, and optional `httpClient` for URL building.

- Use **`setData`** / **`setError`** when you need to change payload or status after creation.
- **`createMockHttpResponse(params)`** is the async factory: it returns a response that is ready to use like one from the real client (you normally do not need to think about internal parsing steps).

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

Builds the function that Vitest can plug into **`vi.spyOn(httpClient, 'request').mockImplementation(...)`**: applies optional `delay`, builds a mock response, and maps your **`success` / `error`** output onto it. The higher-level **`mockHttpClientRequest`** helpers use this internally; call it directly only if you need a custom spy setup.

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

Spies on **`endpoint.request`** and, for each call, arranges a **one-time** stub on that endpoint’s **`httpClient`** so the real endpoint code runs against your fake HTTP result.

- **`mockEndpointRequest`** — each `endpoint.request` installs another one-time client stub with the same `output`.
- **`mockEndpointRequestOnce`** — only the **first** `endpoint.request` is wired to the mock; later calls use an unstubbed client.

The return value is a Vitest **`MockInstance`** for restore / assertions.

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

Each **`endpoint.request`** uses the **next** entry in **`outputs`**. When the list is empty or exhausted, requests use the real client again. Handy for “first call fails, second succeeds” flows.

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

If **`match(params)`** is true for a given call, that call gets a one-time HTTP mock with **`output`**; otherwise the request goes through unchanged. Use for branching (e.g. different behaviour by id).

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

Records the **`FullRequestParams`** your endpoint builds for each **`endpoint.request`**. It does **not** fake **`HttpClient`** by itself—pair it with your own mocks if the request should still complete.

The returned handle exposes **`calls`** (all recorded params), **`last`** (the most recent), **`waitNext()`** (promise for the next call), **`spy`** (Vitest mock instance), and **`restore()`** (detach the spy).

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

Makes **`endpoint.request`** reject with an arbitrary error (not necessarily an **`HttpResponse`**). **`error`** can be a value or a sync/async factory. With **`persistent: true`**, every call throws; otherwise only the first does (then the real client runs again).

**Example — one failure, then real behaviour:**

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
