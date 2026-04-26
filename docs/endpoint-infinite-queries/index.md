# Endpoint infinite queries

```ts
class EndpointInfiniteQuery<> {}
```

This is `mobx-tanstack-query` [`InfiniteQuery`](https://js2me.github.io/mobx-tanstack-query/api/InfiniteQuery) wrapper for `Endpoint`.

Use it when:

- request identity should depend on base endpoint params like filters, sorting, or selected entity
- page loading should depend on `pageParam`
- you want endpoint request wiring, query key creation, and response access to be handled automatically

## Basic example

```ts
const instancesQuery = getServiceInstances.toInfiniteQuery({
  params: () => this.instanceTableParams,
  mergePageParam: "body",
  initialPageParam: { limit: 500, offset: 0 },
  getNextPageParam: (lastPage, _, lastPageParam) => {
    const instances = Object.values(lastPage.data || {})[0]?.instances;

    if (!instances?.length) {
      return undefined;
    }

    return {
      limit: lastPageParam.limit,
      offset: lastPageParam.offset + lastPageParam.limit,
    };
  },
});
```

In this example:

- `params` controls base request params and query identity
- `pageParam` is merged into request `body`
- `queryKey`, `meta`, and `queryFn` are created for you

## How request params are built

`EndpointInfiniteQuery` separates two concepts:

- `params`: base endpoint params used for `queryKey` and query enabled state
- `pageParam`: per-page params used only while loading the current page

This means filters and sorting usually belong to `params`, while pagination belongs to `pageParam`.

## API

### params

Base endpoint params used to build `queryKey` and detect whether query can be enabled.

```ts
const query = getFruits.toInfiniteQuery({
  params: () => ({
    query: {
      search: this.search,
      sort: this.sort,
    },
  }),
  mergePageParam: "query",
  initialPageParam: { limit: 20, offset: 0 },
  getNextPageParam: () => undefined,
});
```

### response

Raw HTTP response returned by the last endpoint request.

```ts
const query = getFruits.toInfiniteQuery({
  mergePageParam: "query",
  initialPageParam: { limit: 20, offset: 0 },
  getNextPageParam: () => undefined,
});

await query.refetch();

console.log(query.response?.status);
console.log(query.response?.data);
```

### mergePageParam

Controls how `pageParam` is merged into endpoint params before request.

Supported shortcuts:

- `'params'`
- `'body'`
- `'query'`
- `'headers'`

#### Merge into `body`

```ts
const query = getFruits.toInfiniteQuery({
  params: () => ({
    body: {
      search: this.search,
    },
  }),
  mergePageParam: "body",
  initialPageParam: { limit: 20, offset: 0 },
  getNextPageParam: () => undefined,
});
```

This produces a request similar to:

```ts
{
  body: {
    search: this.search,
    limit: 20,
    offset: 0,
  },
}
```

#### Merge into `query`

```ts
const query = getFruits.toInfiniteQuery({
  params: {
    query: {
      search: "apple",
    },
  },
  mergePageParam: "query",
  initialPageParam: { limit: 20, offset: 0 },
  getNextPageParam: () => undefined,
});
```

#### Custom merge function

Use a function when pagination data should be shaped manually.

```ts
const query = getFruits.toInfiniteQuery({
  params: () => this.tableParams,
  initialPageParam: {
    cursor: null,
    limit: 20,
  },
  mergePageParam: (params, pageParam, ctx) => ({
    ...params,
    query: {
      ...params?.query,
      cursor: pageParam.cursor,
    },
    body: {
      ...params?.body,
      limit: pageParam.limit,
      source: ctx.queryKey[0],
    },
  }),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});
```

### Using only `pageParam`

If your endpoint does not need base params, you can omit `params` completely and build request data only from `pageParam`.

```ts
const query = getAuditLogs.toInfiniteQuery({
  mergePageParam: "query",
  initialPageParam: { limit: 100, offset: 0 },
  getNextPageParam: (lastPage, _, lastPageParam) => {
    if (!lastPage.items.length) {
      return undefined;
    }

    return {
      limit: lastPageParam.limit,
      offset: lastPageParam.offset + lastPageParam.limit,
    };
  },
});
```

This works best when endpoint `requiredParams` are empty or already satisfied by the merged `pageParam`.

### transform

Transforms raw endpoint response into page data stored in the infinite query.

```ts
const query = getFruits.toInfiniteQuery({
  mergePageParam: "query",
  initialPageParam: { limit: 20, offset: 0 },
  transform: (response) => response.data.items,
  getNextPageParam: () => undefined,
});
```

### update()

Updates infinite query options and optionally replaces base `params`.

```ts
const query = getFruits.toInfiniteQuery({
  mergePageParam: "query",
  initialPageParam: { limit: 20, offset: 0 },
  getNextPageParam: () => undefined,
});

query.update({
  params: {
    query: {
      search: "banana",
    },
  },
});
```

### start()

Sets base params and starts the infinite query.

```ts
const query = getFruits.toInfiniteQuery({
  mergePageParam: "query",
  initialPageParam: { limit: 20, offset: 0 },
  getNextPageParam: () => undefined,
});

await query.start({
  query: {
    search: "banana",
  },
});
```

## Differences between `EndpointInfiniteQuery` and `InfiniteQuery`

### Automatic endpoint request wiring

`EndpointInfiniteQuery` creates:

- query meta via `endpoint.toQueryMeta()`
- query key via `endpoint.toInfiniteQueryKey()`
- request execution via `endpoint.request()`
- raw response access via `query.response`

### `params` are query identity, `pageParam` is page state

`params` should describe which list you are loading.
`pageParam` should describe which page of that list you are loading.

This helps avoid manual `queryFn` boilerplate and keeps query identity stable.

### Falsy `params` disable the query

Like `EndpointQuery`, passing a falsy `params` value disables the query.

```ts
const query = getFruits.toInfiniteQuery(() => ({
  params: this.tableParams,
  mergePageParam: "query",
  initialPageParam: { limit: 20, offset: 0 },
  getNextPageParam: () => undefined,
}));
```

If `this.tableParams` is `null`, `undefined`, `false`, `0`, or `''`, the query stays disabled.

## Errors

### `#1 invalid pageParam shape`

Full error:

```txt
[mobx-tanstack-query-api] "<mergePageParam>" mergePageParam expects
an object pageParam. Use a custom mergePageParam
function for primitive page params.
```

This happens when `mergePageParam` is one of string shortcuts (`'params' | 'body' | 'query' | 'headers'`), but current `pageParam` is not an object.

Wrong:

```ts
const query = getFruits.toInfiniteQuery({
  mergePageParam: "query",
  initialPageParam: 0,
  getNextPageParam: () => undefined,
});
```

Correct options:

- pass object `pageParam` for string merge shortcuts
- or use custom `mergePageParam` function for primitive `pageParam`

```ts
const query = getFruits.toInfiniteQuery({
  initialPageParam: 0,
  mergePageParam: (params, pageParam) => ({
    ...params,
    query: {
      ...params?.query,
      offset: pageParam,
    },
  }),
  getNextPageParam: () => undefined,
});
```

## Extras

### `ToEndpointInfiniteQuery` type

This type converts an `Endpoint` type to `EndpointInfiniteQuery`.

```ts
import type { ToEndpointInfiniteQuery } from "mobx-tanstack-query-api";
import { getFruits } from "@/shared/api/__generated__";

type GetFruitsInfiniteQuery = ToEndpointInfiniteQuery<
  typeof getFruits,
  Awaited<ReturnType<typeof getFruits>>["data"],
  { limit: number; offset: number }
>;
```
