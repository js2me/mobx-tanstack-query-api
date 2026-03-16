# Endpoints

`Endpoint` is the main runtime wrapper around a generated HTTP operation.
It can be used in three ways:

1. As a callable function: `endpoint(params)`
2. As an explicit request helper: `endpoint.request(params)`
3. As a factory for query and mutation helpers

## Basic usage

```ts
import { Endpoint } from "mobx-tanstack-query-api";

export const getShotguns = new Endpoint<...>(configuration, queryClient, httpClient);

const response = await getShotguns({ page: 1 });

if (getShotguns.checkResponse(response, 200)) {
  console.log(response.data);
}
```

## Query and mutation helpers

You can transform an endpoint into higher-level helpers:

- Use `.toQuery()` to create an `EndpointQuery`
- Use `.toInfiniteQuery()` to create an `EndpointInfiniteQuery`
- Use `.toMutation()` to create an `EndpointMutation`

Read more:

- [Endpoint queries](/endpoint-queries/)
- [Endpoint mutations](/endpoint-mutations/)

```ts
const getShotgunsQuery = getShotguns.toQuery({
  params: { page: 1 },
});

const createShotgunMutation = getShotguns.toMutation({});
```

## API reference

<a id="constructor"></a>
## constructor

Creates a callable `Endpoint` instance from:

- `configuration`: generated endpoint configuration
- `queryClient`: query client used by query and mutation helpers
- `httpClient`: HTTP client used for URL building and requests

The constructor returns a callable object, so both forms below are valid:

```ts
await getShotguns({ page: 1 });
await getShotguns.request({ page: 1 });
```

<a id="endpointid"></a>
## endpointId

A unique runtime identifier generated per endpoint instance with `crypto.randomUUID()`.
Useful when you need to track a concrete endpoint instance in metadata or debugging tools.

<a id="presets"></a>
## presets

Mutable presets used by helper factories.
Right now the main use case is `presets.mutations.invalidateQueries`, which becomes the default invalidation config for `.toMutation()` when the mutation options do not override it.

```ts
endpoint.presets.mutations.invalidateQueries = {
  group: endpoint.group,
};
```

<a id="meta"></a>
## meta

Endpoint-level metadata taken from `configuration.meta`.
If no metadata was provided, the field is initialized with an empty object.

```ts
const namespace = endpoint.meta.namespace;
```

<a id="configuration"></a>
## configuration

The raw endpoint configuration object used by the runtime.
It contains the generated request builder, operation id, tags, path segments, contracts, and optional grouping metadata.

Use this property when you need direct access to low-level generated config instead of the convenience helpers.

<a id="queryclient"></a>
## queryClient

The `EndpointQueryClient` attached to the endpoint.
It is used internally by `.toQuery()`, `.toInfiniteQuery()`, `.toMutation()`, and `.invalidateQuery()`.

<a id="httpclient"></a>
## httpClient

The `HttpClient` instance attached to the endpoint.
It is used to build full URLs and execute the underlying request.

<a id="getfullurl"></a>
## getFullUrl()

Builds the final request URL for a specific params object, including base URL and query string.
This is useful for debugging, logging, and precomputing links without sending the request.

```ts
const url = endpoint.getFullUrl({ id: 42 });
```

<a id="getpath"></a>
## getPath()

Builds only the resolved request path for the provided params.
Unlike `.getFullUrl()`, it does not include the base URL.

```ts
const path = endpoint.getPath({ id: 42 });
```

<a id="getparamsfromcontext"></a>
## getParamsFromContext()

Extracts endpoint params from a TanStack Query `QueryFunctionContext`.
This is especially useful when you create an `InfiniteQuery` manually and need to recover the base endpoint params from the query key inside `queryFn`.

```ts
const itemsInfiniteQuery = new InfiniteQuery({
  abortSignal: this.unmountSignal,
  resetOnDestroy: true,
  removeOnDestroy: true,
  autoRemovePreviousQuery: true,
  queryClient,
  meta: getItems.toQueryMeta(),
  options: () => {
    if (!this.tableParams) {
      return {
        enabled: false,
      };
    }

    return {
      enabled: true,
      queryKey: getItems.toInfiniteQueryKey(this.tableParams),
    };
  },
  queryFn: async (ctx) => {
    const { pageParam } = ctx;
    const params = getItems.getParamsFromContext(ctx);
    const response = await getItems({
      ...params,
      body: {
        ...params.body,
        limit: pageParam.limit,
        offset: pageParam.offset,
      },
    });

    return response.data;
  },
  initialPageParam: { limit: 500, offset: 0 },
  refetchInterval: (query) => {
    const pagesCount = query.state.data?.pages.length ?? 0;

    if (pagesCount === 1 && query.state.status === "success") {
      return 15_000;
    }

    return false;
  },
  getNextPageParam: (lastPage, _, lastPageParam) => {
    const lastLoadedItems = Object.values(lastPage.data || {})[0]?.items;

    if (!lastLoadedItems?.length) {
      return undefined;
    }

    const nextOffset = lastPageParam.offset + lastPageParam.limit;

    if (
      this.collectionDetails &&
      nextOffset > this.collectionDetails.items.length
    ) {
      return undefined;
    }

    return {
      limit: lastPageParam.limit,
      offset: nextOffset,
    };
  }
});
```

<a id="tags"></a>
## tags

Returns endpoint tags from the generated configuration.
Tags are commonly used for grouping and invalidation logic.

<a id="path"></a>
## path

Returns the endpoint path declaration as an array of path segments.

```ts
console.log(endpoint.path); // ["users", "{id}"]
```

<a id="pathdeclaration"></a>
## pathDeclaration

Returns the endpoint path declaration as a slash-joined string.
This is convenient for logging and metadata where a string is easier to store than an array.

```ts
console.log(endpoint.pathDeclaration); // users/{id}
```

<a id="operationid"></a>
## operationId

Returns the generated operation identifier for the endpoint.
This value is often the most stable way to identify an operation across logs, metadata, and helper abstractions.

<a id="group"></a>
## group

Returns the optional endpoint group from the configuration.
Groups are commonly used to invalidate related endpoints together.

<a id="namespace"></a>
## namespace

Returns the optional endpoint namespace from the configuration.
This can be used to organize generated endpoints by domain or API section.

<a id="checkresponse"></a>
## checkResponse()

Type guard that checks whether a value is a valid HTTP response produced by the runtime.
When a status code is provided, it also narrows the response to that specific status.

```ts
if (endpoint.checkResponse(response, 200)) {
  response.data;
}
```

<a id="request"></a>
## request()

Executes the HTTP request for the provided params.

When endpoint contracts are configured, `.request()` can also:

- validate input params before sending the request
- validate successful response data after receiving the response
- either warn or throw on validation errors depending on runtime configuration

```ts
const response = await endpoint.request({ id: 42 });
```

The callable form `endpoint(params)` delegates to this method.

<a id="toquerymeta"></a>
## toQueryMeta()

Builds query metadata enriched with endpoint-specific fields.
The resulting object includes:

- `tags`
- `operationId`
- `path`
- `pathDeclaration`
- `endpointId`
- `endpointQuery: true`

Use this when you want a consistent metadata shape for queries derived from endpoints.

<a id="toquerykey"></a>
## toQueryKey()

Builds a stable TanStack Query key for regular queries.
The key includes:

- endpoint path segments
- operation id
- params object
- resolved `uniqKey`

```ts
const queryKey = endpoint.toQueryKey({ id: 42 });
```

<a id="toinfinitequerykey"></a>
## toInfiniteQueryKey()

Builds a stable TanStack Query key for infinite queries.
It is similar to `.toQueryKey()`, but prepends an internal `{ infiniteQuery: true }` marker so the key does not collide with a regular query key.

<a id="invalidatequery"></a>
## invalidateQuery()

Invalidates the exact query generated by `.toQueryKey()`.
You can pass:

- `params`
- optional invalidation filters
- optional invalidation options

```ts
endpoint.invalidateQuery({ id: 42 });
```

This helper automatically sets `exact: true`.

<a id="tomutation"></a>
## toMutation()

Creates an `EndpointMutation` bound to the current endpoint.
Use it when the endpoint should behave like a mutation and integrate with the query client invalidation workflow.

```ts
const mutation = endpoint.toMutation({
  onSuccess: () => {
    endpoint.invalidateQuery({ id: 42 });
  },
});
```

<a id="toquery"></a>
## toQuery()

Creates an `EndpointQuery` bound to the current endpoint.
This is the main way to connect an endpoint to reactive query state.

```ts
const query = endpoint.toQuery({
  params: { id: 42 },
});
```

<a id="toinfinitequery"></a>
## toInfiniteQuery()

Creates an `EndpointInfiniteQuery` bound to the current endpoint.
Use it for paginated endpoints that load data page by page.

```ts
const infiniteQuery = endpoint.toInfiniteQuery({
  params: () => this.tableParams,
  mergePageParam: "body",
  initialPageParam: { limit: 20, offset: 0 },
});
```