# `MockHttpResponse` and `createMockHttpResponse`

For advanced cases where you construct or inspect **`HttpResponse`** yourself.

## Default status values

Status fallbacks use the exported object [**`testingDefaults`**](../testing-defaults.html) (**`successStatus`**, **`errorStatus`**; initially **200** / **500**, mutable). **`MockHttpResponse`** (constructor / **`setData`** / **`setError`**) and [`mswEndpointResponse` / `mswEndpointErrorResponse`](../msw-endpoint-response.html) read the **current** property values.

## `MockHttpResponse`

A test-oriented subclass of runtime `HttpResponse`. Constructor options include request info (`requestParams`, etc.), optional `data` / `error` / `status`, and optional `httpClient` for URL building.

- Use **`setData`** / **`setError`** when you need to change payload or status after creation.
- **`createMockHttpResponse(params)`** is the async factory: it constructs a **`MockHttpResponse`** and awaits **`resolveBody`**, so `data` / `error` match ordinary client behavior before you use the instance.

**Example:**

```ts
import { createMockHttpResponse } from 'mobx-tanstack-query-api/testing';

const response = await createMockHttpResponse({
  requestParams: { path: '/users', method: 'GET', format: 'json' },
  data: { name: 'Ada' },
});
expect(response.data).toEqual({ name: 'Ada' });
```
