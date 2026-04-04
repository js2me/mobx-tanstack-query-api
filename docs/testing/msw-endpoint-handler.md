# `mswEndpointHandler`

```ts
import type { AnyEndpoint } from "mobx-tanstack-query-api";
import type { MswEndpointBodyResolver } from "mobx-tanstack-query-api/testing";
import type { HttpHandler } from "msw";

export interface MswEndpointHttpHandler extends HttpHandler {
  endpoint: AnyEndpoint;
}

export function mswEndpointHandler<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  resolver: MswEndpointBodyResolver<TEndpoint>,
): MswEndpointHttpHandler;
```

Wraps MSW’s **`http.get` / `http.post` / …** so the URL comes from the **endpoint** via [`mswPathPattern`](./msw-path-pattern.html). The HTTP verb is taken from **`endpoint.configuration.params({}).method`** (the same object codegen produces for `request`).

The returned value is MSW’s **`HttpHandler`** plus **`endpoint`**: the same **endpoint** instance you passed in (for introspection in tests, logging, or utilities).

The **resolver** matches MSW’s `(info) => …` shape (same **`info`** as `http.*(path, resolver)`). Its return type is **`MswEndpointBodyResolver`** in the package typings: **`Response`** / **`Promise<Response>`**, or **data** inferred from the endpoint’s success **`HttpResponse`** (with **`NoInfer`**, so the endpoint type is fixed by the **first** argument, not by the resolver).

Requires **`msw`** in your project (optional peer dependency). See the [MSW recipe](./recipes/msw.html).

**Shorthand data** — return JSON-serialisable values (objects, arrays, primitives, strings) and they are sent with **`Response.json`** and the same default status as [`mswEndpointResponse`](./msw-endpoint-response.html). **`Blob`**, **`ArrayBuffer`**, typed arrays, **`ReadableStream`**, **`FormData`**, and **`URLSearchParams`** use **`new Response`** with the same default status. When **`TData`** is **`ArrayBuffer`**, typed array views are also allowed (same as **`fetch`**). For **success** with a **custom status** or headers, return [`mswEndpointResponse`](./msw-endpoint-response.html) or any **`Response`** / MSW **`HttpResponse`**. For **non-OK** responses with a typed **`error`** payload, use [`mswEndpointErrorResponse`](./msw-endpoint-response.html). Success and error defaults come from [`testingDefaults`](./testing-defaults.html).

**Example**

```ts
import {
  mswEndpointHandler,
  mswEndpointResponse,
} from "mobx-tanstack-query-api/testing";

export const handlers = [
  mswEndpointHandler(listFruitsEndpoint, () => ({
    items: ["apple", "banana"],
  })),
  mswEndpointHandler(createFruitEndpoint, async ({ request }) => {
    const body = (await request.json()) as { name: string };
    return mswEndpointResponse(createFruitEndpoint, { id: 1, name: body.name }, {
      status: 201,
    });
  }),
];
```
