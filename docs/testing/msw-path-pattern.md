# `mswPathPattern`

Returns a **full URL string** for [MSW](./recipes/msw.html): **`baseUrl`** + path, with **`{segment}`** turned into MSW **`:segment`**. No query string. If your real path has extra bits not in **`configuration.path`**, adjust the string yourself.

Prefer [`mswEndpointHandler`](./msw-endpoint-handler.html) when you want method + URL + resolver in one helper.

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
