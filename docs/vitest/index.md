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
