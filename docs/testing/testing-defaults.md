# `testingDefaults`

Mutable defaults shared across **`mobx-tanstack-query-api/testing`**. Initial values are **200** / **500**; you can reassign **`successStatus`** / **`errorStatus`** (for example in **`beforeAll`**) to affect every helper that reads this object.

```ts
import { testingDefaults } from "mobx-tanstack-query-api/testing";

// testingDefaults.successStatus === 200
// testingDefaults.errorStatus === 500

testingDefaults.errorStatus = 400; // optional global override for error mocks
```

Type shape (exported from **`mobx-tanstack-query-api/testing`**):

```ts
export const testingDefaults: {
  successStatus: number;
  errorStatus: number;
};
```

## Where it is used

- **`successStatus`** — [`MockHttpResponse`](./low-level/mock-http-response.html) (constructor when resolving status from `data` / **`setData`**) and [`mswEndpointResponse`](./msw-endpoint-response.html) (default `Response` status).
- **`errorStatus`** — **`MockHttpResponse`** (constructor when resolving from `error` / **`setError`**) and [`mswEndpointErrorResponse`](./msw-endpoint-response.html).

Per-request overrides are unchanged: pass **`status`** on **`MockHttpResponse`** params / **`setData`** / **`setError`**, or **`init.status`** on the MSW helpers.

## See also

- [Testing overview](./index.html) — how the **`testing`** entry point fits together.
- [MSW recipe](./recipes/msw.html) — handlers often return [`mswEndpointResponse`](./msw-endpoint-response.html), which uses these defaults.
