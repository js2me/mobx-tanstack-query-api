# `mswEndpointHandler`

Registers an MSW handler for a generated **endpoint**: **method** and **URL pattern** come from the endpoint (path params follow MSW’s `:name` form via [`mswPathPattern`](./msw-path-pattern.html)).

The return value is a normal MSW **`HttpHandler`** with the same **`endpoint`** attached, so tests can reuse the instance you passed in.

The **resolver** is the same function MSW expects for **`http.*`** handlers. Returning a **plain value** (not a **`Response`**) always builds a **successful** reply (typed like the endpoint’s success **`data`**). For **errors**, non-OK statuses, or extra headers, return a **`Response`** — typically [`mswEndpointErrorResponse`](./msw-endpoint-response.html) / [`mswEndpointResponse`](./msw-endpoint-response.html) or MSW’s helpers. Default status codes for the package-built responses come from [`testingDefaults`](./testing-defaults.html).

Requires the **`msw`** peer dependency. Setup and lifecycle are in the [MSW recipe](./recipes/msw.html).

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
