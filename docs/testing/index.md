# Testing

::: info Vitest
**Vitest is the intended runner for almost everything here.** The `mobx-tanstack-query-api/testing` entry point is built around Vitest’s mocking APIs (`vi.spyOn`, `vi.fn`, `MockInstance`, and the like). Examples and types assume Vitest; other runners can reuse the ideas, but you may need to swap in equivalent mocks.
:::

Optional helpers for unit-testing code that uses [`HttpClient`](/http-client/index.html) and generated **endpoints**. They stub `HttpClient.request` or install short-lived client stubs around `endpoint.request`, so tests avoid the network while still receiving **`HttpResponse`** instances consistent with the runtime package.

For **integration-style** tests that keep the real `fetch` path and mock at the HTTP layer, see the [MSW recipe](/testing/recipes/msw.html).

Shared HTTP status defaults live in the exported object [**`testingDefaults`**](./testing-defaults.html): **`successStatus`** and **`errorStatus`** (initially **200** and **500**). Helpers read the **current** numbers, so you can reassign them globally; [`MockHttpResponse`](./low-level/mock-http-response.html) and [`mswEndpointResponse` / `mswEndpointErrorResponse`](./msw-endpoint-response.html) all use this object.

::: tip Peer dependencies
**`vitest`** (`>=4`) is optional: install it when you use the `vi`-based helpers from **`mobx-tanstack-query-api/testing`**. **`msw`** (`>=2`) is optional and only needed for **`mswPathPattern`** / **`mswEndpointHandler`**. This repository maps the `testing` subpath in `tsconfig` for local development.
:::

```ts
import {
  mockHttpClientRequestOnce,
  mockEndpointRequest,
} from 'mobx-tanstack-query-api/testing';
```
