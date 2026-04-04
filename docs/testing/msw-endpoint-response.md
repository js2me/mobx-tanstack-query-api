# `mswEndpointResponse` / `mswEndpointErrorResponse`

Build a **`Response`** for an MSW resolver with **`data`** / **`error`** typed from the endpoint (same idea as `response.data` / `response.error` from `HttpClient.request`). The **`endpoint`** argument is only for TypeScript; at runtime it is not used.

Omit **`init.status`** to use defaults from [**`testingDefaults`**](./testing-defaults.html); pass **`init`** when you need a specific status or headers.

Often you can return success **data directly** from [`mswEndpointHandler`](./msw-endpoint-handler.html); these helpers matter when you want an explicit **`Response`** or **`ResponseInit`**.

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
