# `mswEndpointResponse` / `mswEndpointErrorResponse`

```ts
export function mswEndpointResponse<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  data: InferEndpointMswSuccessBody<TEndpoint>,
  init?: ResponseInit,
): Response;

export function mswEndpointErrorResponse<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  error: InferEndpointMswErrorBody<TEndpoint>,
  init?: ResponseInit,
): Response;
```

Typed helpers for MSW resolvers: **`data`** / **`error`** are inferred from the endpoint’s **`HttpResponse<…>`** generic (same shapes as `response.data` / `response.error` after `HttpClient.request`).

The **`endpoint`** argument is only used for **TypeScript inference**; at runtime it is ignored. Pass the same instance you use with [`mswEndpointHandler`](./msw-endpoint-handler.html).

When **`init.status`** is omitted, status comes from **`testingDefaults.successStatus`** / **`testingDefaults.errorStatus`** ([**`testingDefaults`**](./testing-defaults.html); initially **200** / **500**, same object as **`MockHttpResponse`**, fields are assignable for global overrides). Per response, override with **`init.status`** (e.g. **201** or **400**).

For success payloads you can often return **data directly** from [`mswEndpointHandler`](./msw-endpoint-handler.html) (see that page); **`mswEndpointResponse`** stays useful when you need **`ResponseInit`** (status, headers) or want an explicit **`Response`** in the resolver.

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
    return mswEndpointResponse(
      createFruitEndpoint,
      { id: 1, name: body.name },
      { status: 201 },
    );
  }),
];
```
