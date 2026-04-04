# `mswEndpointResponse` / `mswEndpointErrorResponse`

```ts
function mswEndpointResponse<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  data: InferEndpointMswSuccessBody<TEndpoint>,
  init?: ResponseInit,
): Response;

function mswEndpointErrorResponse<TEndpoint extends AnyEndpoint>(
  endpoint: TEndpoint,
  error: InferEndpointMswErrorBody<TEndpoint>,
  init?: ResponseInit,
): Response;
```

Typed helpers for MSW resolvers: **`data`** / **`error`** are inferred from the endpoint’s **`HttpResponse<…>`** generic (same shapes as `response.data` / `response.error` after `HttpClient.request`).

The **`endpoint`** argument is only used for **TypeScript inference**; at runtime it is ignored. Pass the same instance you use with [`mswEndpointHandler`](./msw-endpoint-handler.html).

Default status: **200** for success, **400** for error (override with **`init.status`**, e.g. **201** for created).

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
