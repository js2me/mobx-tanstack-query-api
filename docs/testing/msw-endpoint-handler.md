# `mswEndpointHandler`

```ts
import type { HttpHandler } from "msw";

export interface MswEndpointHttpHandler extends HttpHandler {
  endpoint: AnyEndpoint;
}

export function mswEndpointHandler(
  endpoint: AnyEndpoint,
  resolver: Parameters<typeof http.get>[1],
  methodOverride?: MswEndpointHandlerMethod,
): MswEndpointHttpHandler;
```

Wraps MSW’s **`http.get` / `http.post` / …** so the URL comes from the **endpoint** via [`mswPathPattern`](./msw-path-pattern.html). The HTTP verb is taken from **`endpoint.configuration.params({}).method`** (the same object codegen produces for `request`).

The returned value is MSW’s **`HttpHandler`** plus **`endpoint`**: the same **endpoint** instance you passed in (for introspection in tests, logging, or utilities).

The **resolver** is the same callback you would pass to `http.get(path, resolver)`.

If your `params` does not return a supported `method`, pass **`methodOverride`** as the third argument.

Requires **`msw`** in your project (optional peer dependency). See the [MSW recipe](./recipes/msw.html).

For **typed** JSON bodies matching the endpoint’s **`HttpResponse`**, use [`mswEndpointResponse`](./msw-endpoint-response.html) (or [`mswEndpointErrorResponse`](./msw-endpoint-response.html)); default statuses follow [`testingDefaults`](./testing-defaults.html) unless you pass **`init.status`**. You can still return **`Response.json()`** or **`HttpResponse.json()`** from **`msw`** directly if you prefer.

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
