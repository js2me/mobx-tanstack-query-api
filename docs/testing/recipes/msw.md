# MSW (Mock Service Worker)

[MSW](https://mswjs.io/) intercepts HTTP at the network boundary. Your [`HttpClient`](/http-client/index.html) uses the [`Fetch API`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API), so **no code changes are required** in the client: point `baseUrl` (and paths) at URLs your handlers match, and `fetch` is satisfied by MSW instead of a real server.

This package does **not** ship MSW; add it to your app or test project:

::: code-group

```bash [npm]
npm install msw -D
```

```bash [pnpm]
pnpm add msw -D
```

```bash [yarn]
yarn add msw -D
```

:::

## Node.js (`setupServer`)

Use [`setupServer`](https://mswjs.io/docs/api/setup-server) from `msw/node` so **Node’s `globalThis.fetch`** (and therefore `HttpClient`) is intercepted in the test process.

1. **Handlers** — match the **full URL** the client will request (`baseUrl` + `path` from your endpoint params, including query string if you rely on it).

Use **`mswEndpointHandler`** to register a handler from a generated **endpoint** (it uses **`mswPathPattern`** under the hood). The resolver may return **typed data** directly or a **`Response`**; use **`mswEndpointResponse`** / **`mswEndpointErrorResponse`** when you need a **custom status** or headers. If you only need the URL string, use **`mswPathPattern`** — see [`mswEndpointHandler`](../msw-endpoint-handler.html), [`mswEndpointResponse`](../msw-endpoint-response.html), and [`mswPathPattern`](../msw-path-pattern.html).

```ts
import {
  mswEndpointHandler,
  mswEndpointResponse,
} from "mobx-tanstack-query-api/testing";

// `listFruits`, `createFruit`: your generated endpoints (GET/POST come from `params().method`).
export const handlers = [
  mswEndpointHandler(listFruits, () => ({
    items: ["apple", "banana"],
  })),
  mswEndpointHandler(createFruit, async ({ request }) => {
    const body = (await request.json()) as { name: string };
    return mswEndpointResponse(
      createFruit,
      { id: 1, name: body.name },
      { status: 201 },
    );
  }),
];
```

2. **Server lifecycle** — register once per test file or globally via your runner’s setup file (e.g. [Vitest `setupFiles`](https://vitest.dev/config/#setupfiles)).

```ts
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import { handlers } from "./handlers";

const server = setupServer(...handlers);

beforeAll(() =>
  server.listen({
    onUnhandledRequest: "error", // fail fast if a request has no handler
  }),
);
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

3. **Use your real `HttpClient`** (or generated API module) as in production.

```ts
import { HttpClient } from "mobx-tanstack-query-api";

const httpClient = new HttpClient({
  baseUrl: "https://api.example.com",
});

const res = await httpClient.request({
  path: "/api/v1/fruits",
  method: "GET",
  format: "json",
});

expect(res.data).toEqual({ items: ["apple", "banana"] });
```

Generated **endpoints** call the same `HttpClient.request` path, so `endpoint.request(...)` and `EndpointQuery` / `EndpointMutation` flows work as long as the **resolved URL** matches a handler.

### Tips

- **Default response status** — **`mswEndpointResponse`**, **`mswEndpointErrorResponse`**, and **success** data returned directly from **`mswEndpointHandler`** use **`testingDefaults.successStatus`** / **`errorStatus`** ([**`testingDefaults`**](../testing-defaults.html), initially **200** / **500**; reassign globally if needed) unless you pass **`init.status`** on the **`Response`** helpers (e.g. **400** for validation errors).
- **Absolute URLs** — MSW matches the URL `fetch` receives. If `baseUrl` is `https://api.example.com` and the path is `/users/1`, the handler pattern should be `https://api.example.com/users/1` (or use a [path predicate](https://mswjs.io/docs/http/intercepting-requests#path-parameters) / `new URL(request.url)` inside the resolver for flexibility).
- **Unhandled requests** — `onUnhandledRequest: "error"` catches typos in `baseUrl` or paths early; relax to `"warn"` while migrating.
- **Per-test overrides** — `server.use(http.get(...))` after `setupServer` adds or replaces handlers for a single test; `resetHandlers()` clears them in `afterEach`.

## Browser and E2E

For **browser** tests (e.g. Cypress, Playwright, or Vite-powered dev), MSW runs in the **Service Worker** ([`setupWorker`](https://mswjs.io/docs/api/setup-worker)). The same handler URLs apply; ensure the app’s `HttpClient` `baseUrl` matches what the worker intercepts (often your dev server origin or a dedicated API host).

## When to use MSW vs package Vitest helpers

| Approach | Best for |
| -------- | -------- |
| **MSW** | Exercising the **full** `HttpClient` stack (headers, `buildUrl`, formatters, interceptors), sharing handlers between **browser and Node**, or teams already standardized on MSW. |
| **[Testing helpers](/testing/index.html)** | **Fast** unit tests **without** MSW (Vitest-first), typed **`HttpResponse`** via `mockHttpClientRequest*` / `mockEndpointRequest*`, no global listener. |

You can mix both: MSW for integration-style suites and Vitest helpers for narrow endpoint logic.

## Further reading

- [MSW — Getting started](https://mswjs.io/docs/getting-started)
- [MSW — Integrating Vitest](https://mswjs.io/docs/integrations/node#vitest)
