# Definements

**Definements** lets you describe your own TypeScript types for shared request fields in the library (for example `meta` and `serverVars` on HTTP requests).

The package exports an empty `Definements` interface. You fill it in once in your project — generated endpoints, `HttpClient.request`, and codegen options will use your types.

## Available fields

| Field | Where it applies |
| --- | --- |
| `requestParamsMeta` | `meta` on each request |
| `requestParamsServerVars` | `serverVars` on each request (OpenAPI server URL templates) |

## Setup

Add a `.d.ts` file and include it in `tsconfig.json`:

```ts
// src/types/mobx-tanstack-query-api.d.ts
import "mobx-tanstack-query-api";

declare module "mobx-tanstack-query-api" {
  export interface Definements {
    requestParamsMeta: {
      traceId: string;
      tenantId?: string;
    };
    requestParamsServerVars: {
      env: "prod" | "staging";
      version: string;
    };
  }
}
```

**Important:** keep the line `import "mobx-tanstack-query-api";` at the top. Without it, other imports from the package may stop type-checking in that file.

## Usage

```ts
import { HttpClient } from "mobx-tanstack-query-api";

const http = new HttpClient();

await http.request({
  path: "/api/v1/items",
  method: "GET",
  meta: {
    traceId: "abc-123",
  },
  serverVars: {
    env: "prod",
    version: "v1",
  },
});
```

With codegen you can set defaults — `meta` will be checked the same way:

```ts
import type { RouteBaseInfo } from "mobx-tanstack-query-api/cli";

export default {
  overrideRequestParams: (route: RouteBaseInfo) => ({
    meta: { traceId: route.operationId },
  }),
};
```

## If something does not work

- Add `import "mobx-tanstack-query-api";` to your `.d.ts` file.
- Make sure the file is listed in `tsconfig` `include`.
- Use the correct field names

## See also

- [HttpClient](/http-client/index.html)
- [Codegen: `overrideRequestParams`](/codegen/config.html#overriderequestparams)
- [Codegen: `requestMeta`](/codegen/config.html#requestmeta)
