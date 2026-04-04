# `mswEndpointHandler`

```ts
function mswEndpointHandler(
  endpoint: AnyEndpoint,
  resolver: Parameters<typeof http.get>[1],
  methodOverride?: MswEndpointHandlerMethod,
): HttpHandler;
```

Wraps MSW’s **`http.get` / `http.post` / …** so the URL comes from the **endpoint** via [`mswPathPattern`](./msw-path-pattern.html). The HTTP verb is taken from **`endpoint.configuration.params({}).method`** (the same object codegen produces for `request`).

The **resolver** is the same callback you would pass to `http.get(path, resolver)`.

If your `params` does not return a supported `method`, pass **`methodOverride`** as the third argument.

Requires **`msw`** in your project (optional peer dependency). See the [MSW recipe](./recipes/msw.html).

For **typed** JSON bodies matching the endpoint’s **`HttpResponse`**, use [`mswEndpointResponse`](./msw-endpoint-response.html) (or [`mswEndpointErrorResponse`](./msw-endpoint-response.html)). You can still return **`Response.json()`** or **`HttpResponse.json()`** from **`msw`** directly if you prefer.

**Example**

```ts
import {
  mswEndpointHandler,
  mswEndpointResponse,
} from "mobx-tanstack-query-api/testing";

export const handlers = [
  mswEndpointHandler(listFruitsEndpoint, () =>
    mswEndpointResponse(listFruitsEndpoint, { items: ["apple", "banana"] }),
  ),
];
```
