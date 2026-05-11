# Codegen without queries and mutations

Use this library as a **typed HTTP layer** only: OpenAPI → codegen → endpoints you **`await` like functions**. You do not wire an `EndpointQueryClient`, and you do not use `.toQuery()`, `.toInfiniteQuery()`, or `.toMutation()`.

## When it fits

- You already manage caching, loading state, or retries elsewhere (or you do not need them).
- You want generated paths, params, and response types without query or mutation helpers at the call site.

## Codegen

Set [`queryClient: 'skip'`](/codegen/config#queryclient) in your `api-codegen.config` (alongside your usual `input`, `output`, and so on).

```ts
import { defineConfig } from 'mobx-tanstack-query-api/cli';

export default defineConfig({
  input: 'openapi.yaml',
  output: 'src/api/__generated__',
  queryClient: 'skip',
});
```

That tells codegen you are not using the TanStack Query integration for this output. HTTP behavior is still configured the usual way ([`httpClient`](/codegen/config#httpclient)); only the query-client side is turned off here.

## Runtime usage

Import the generated endpoint and call it with your params (or use `.request()` with the same args).

```ts
import { getUser } from '@/api/__generated__/endpoints/get-user';

const response = await getUser({ path: { id: '42' } });

if (getUser.checkResponse(response, 200)) {
  console.log(response.data);
}
```

Equivalent:

```ts
const response = await getUser.request({ path: { id: '42' } });
```

See [Endpoints — basic usage](/endpoints/index.html#basic-usage) for response narrowing with `checkResponse`.

## What to avoid in this mode

Do not use query or mutation helpers on these endpoints:

- `.toQuery()`
- `.toInfiniteQuery()`
- `.toMutation()`
- `.invalidateQuery()`

For this recipe, use **direct calls** (`endpoint(params)` or `.request()`) and the usual URL helpers if you need them (for example `.getFullUrl()`, `.getPath()`).

## Related docs

- [`queryClient` option](/codegen/config#queryclient)
- [Endpoints](/endpoints/index.html) — callable endpoint and `request()`
