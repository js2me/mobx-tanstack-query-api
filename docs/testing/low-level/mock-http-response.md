# `MockHttpResponse` and `createMockHttpResponse`

For advanced cases where you construct or inspect **`HttpResponse`** yourself.

## Default status values

Statuses fall back to [**`testingDefaults`**](../testing-defaults.html) unless you set **`status`** explicitly.

## `MockHttpResponse`

A test-oriented subclass of runtime `HttpResponse`. Constructor options include request info (`requestParams`, etc.), optional `data` / `error` / `status`, and optional `httpClient` for URL building.

- Use **`setData`** / **`setError`** when you need to change payload or status after creation.
- **`createMockHttpResponse(params)`** is the async factory: it constructs a **`MockHttpResponse`** and awaits **`resolveBody`**, so `data` / `error` match ordinary client behavior before you use the instance.
- **`MockHttpResponse.fromEndpoint(endpoint, params)`** is the static factory that derives **`requestParams`** (and **`request.url`**) from a real endpoint — via **`endpoint.configuration.params(input)`** and the endpoint's **`HttpClient`**. `data` / `error` / `status` are typed from the endpoint's **`HttpResponse`**. Body resolution matches the constructor: call **`resolveBody`** to apply `data` / `error`.

**Example:**

```ts
import { createMockHttpResponse } from 'mobx-tanstack-query-api/testing';

const response = await createMockHttpResponse({
  requestParams: { path: '/users', method: 'GET', format: 'json' },
  data: { name: 'Ada' },
});
expect(response.data).toEqual({ name: 'Ada' });
```

**Example (`fromEndpoint`):**

```ts
import { MockHttpResponse } from 'mobx-tanstack-query-api/testing';

const response = MockHttpResponse.fromEndpoint(getUser, {
  input: { id: 1 },
  data: { name: 'Ada' },
});
expect(response.request.url).toBe('https://api.test/users/1');
await response.resolveBody('json');
expect(response.data).toEqual({ name: 'Ada' });
```
