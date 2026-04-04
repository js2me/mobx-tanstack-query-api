# `mswPathPattern`

```ts
function mswPathPattern(endpoint: AnyEndpoint): string;
```

Builds a **full URL pattern** for [MSW](./recipes/msw.html) from the endpoint’s **`httpClient.baseUrl`** and **`configuration.path`**, converting OpenAPI-style **`{segment}`** into MSW **`:segment`** path params.

To register a handler in one step, prefer [`mswEndpointHandler`](./msw-endpoint-handler.html).

Does **not** add query strings. If the real `params().path` includes a prefix that is not represented in `configuration.path`, extend or replace the string manually.

**Example**

```ts
import { http } from "msw";
import { mswPathPattern, mswEndpointResponse } from "mobx-tanstack-query-api/testing";

http.get(mswPathPattern(getUserEndpoint), ({ params }) =>
  mswEndpointResponse(getUserEndpoint, {
    id: params.id,
    name: "Ada",
  }),
);
```
