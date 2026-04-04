# `testingDefaults`

Global default HTTP statuses for testing helpers: **`successStatus`** and **`errorStatus`** start at **200** and **500**. Reassign them (e.g. in **`beforeAll`**) if most mocks in a suite should use something else.

```ts
import { testingDefaults } from "mobx-tanstack-query-api/testing";

testingDefaults.errorStatus = 400;
```

Used by [`MockHttpResponse`](./low-level/mock-http-response.html), [`mswEndpointResponse`](./msw-endpoint-response.html), and [`mswEndpointErrorResponse`](./msw-endpoint-response.html). For a single mock, override with **`status`** / **`setData`** / **`setError`** on **`MockHttpResponse`**, or **`init.status`** on the MSW helpers.

## See also

- [Testing overview](./index.html)
- [MSW recipe](./recipes/msw.html)
