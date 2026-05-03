# Endpoint queries

```ts
class EndpointQuery<> {}
```

This is the [`Query`](https://js2me.github.io/mobx-tanstack-query/api/Query) class from `mobx-tanstack-query`, wrapped around an `Endpoint` instance.

Example:  
```ts
import { yourEndpoint } from "@/shared/api/__generated__";

export const yourEndpointQuery = yourEndpoint.toQuery({})

console.log(yourEndpointQuery.isLoading, yourEndpointQuery.data);
``` 

## API

### params

The observable **current endpoint input** for `EndpointQuery` (path, query, body, headers, etc.): it drives the **query key** and, with **`requiredParams`**, whether the query is **enabled**—any **falsy** `params` disables the fetch; otherwise the query can run when required fields are satisfied.

_Examples with disabled queries:_  
```ts
const query = getFruits.toQuery(() => ({
  params: null,
}));
const query = getFruits.toQuery(() => ({
  params: '',
}));
const query = getFruits.toQuery(() => ({
  params: false,
}));
const query = getFruits.toQuery(() => ({
  params: undefined,
}));
const query = getFruits.toQuery({
  params: 0,
});
const query = getFruits.toQuery({
  params: () => 0,
});
```

_Examples with enabled queries:_  
```ts
const query = getFruits.toQuery(() => ({
  params: {},
}));
const query = getFruits.toQuery(() => ({
  params: { query: {} },
}));
const query = getFruits.toQuery({
  params: { query: {} },
});
const query = getFruits.toQuery({
  params: () => ({ query: {} }),
});
```

:::tip Omitting `params`
If you omit `params`, it defaults to `{}`. The query is **enabled** when the endpoint has no entries in `requiredParams`, or when `params` is truthy and **every** key listed in `requiredParams` is present on the `params` object. Otherwise the query stays disabled until you pass suitable `params`.
:::

### `uniqKey`

Optional extra segment appended when the endpoint builds the TanStack **`queryKey`** (see [`Endpoint.toQueryKey`](/endpoints/index.html#toquerykey)). Use it when the **same** `params` should map to **different** cache entries (e.g. tenant id, A/B bucket, or a MobX-backed discriminator).

It may be a **plain value**, or a **function** (including one that reads observables) so the key updates reactively—same rules as reactive `params`.

```ts
getFruits.toQuery({
  params: { query: { limit: 10 } },
  uniqKey: () => store.activeTenantId,
});
```

### `transform`

Optional async (or sync) mapper from the full **`HttpResponse`** (typed per endpoint) to the value stored as query **`data`**. The observable **`response`** getter still holds the **raw** response after the request; **`.data`** (and `select`, if you use it) see the **transformed** value.

```ts
const query = getFruitById.toQuery({
  params: { path: { id: '1' } },
  transform: async (res) => {
    // res.status, res.headers, res.data, …
    return res.data;
  },
});
```

### Factory: `toQuery(() => ({ … }))`

Use the factory overload of [`Endpoint.toQuery()`](/endpoints/index.html#toquery): pass a **callback** instead of a plain options object when you want **one** reactive function that returns both **`params`** and any other TanStack fields (`staleTime`, `gcTime`, `placeholderData`, …). On each run, keys other than `params`, `uniqKey`, `transform`, and the reserved `Query` ctor fields are merged as **dynamic options** into the observer (similar in spirit to `Query`’s separate **`options(query) => …`** hook, but flattened into a single return object).

```ts
import { observable } from 'mobx';

const state = observable({ limit: 10 });

export const fruitsQuery = getFruits.toQuery(() => ({
  params: { query: { limit: state.limit } },
  staleTime: state.limit > 50 ? 60_000 : 5_000,
}));
```

```ts{1,16}
const query = getFruits.toQuery({});

// where getFruits
export const getFruits = new Endpoint<
  HttpResponse<..., ...>,
  ...,
  any
>(
  {
    params: ({ query, requestParams }) => ({
      path: `/api/v1/fruits`,
      method: "GET",
      query: query,
      ...requestParams,
    }),
    requiredParams: [],
    operationId: "getFruits",
    path: ["api", "v1", "fruits"],
    tags: [Tag.Fruits],
    meta: {},
  },
  queryClient,
  httpClient,
);
```

### response

Observable **last `HttpResponse`** from `endpoint.request` (status, headers, parsed `data`), or **`null`** until a request finishes and whenever a new fetch clears it at the start. Query **`.data`** can differ if you use **`transform`**; **`response`** stays the raw HTTP-layer object—use it for status, headers, or the body before transformation.
```ts
const fruitsQuery = getFruits.toQuery({
  params: { query: { limit: 10 } },
});

await fruitsQuery.refetch();

console.log(fruitsQuery.response?.status); // e.g. 200
console.log(fruitsQuery.response?.data); // matches query `.data` unless `transform` is used
```

### `update()`

This method accepts a `params` field as well: a falsy value disables the query, a valid params object enables it (subject to `requiredParams`; see [**params**](#params)).

```ts
const query = getFruits.toQuery({});

query.update({ params: {} });
```

### `start(endpointParams)`

Imperatively sets **`params`** (the endpoint’s **HTTP input** shape: path, query, body, …) and then runs the same **`update` + `refetch`** flow as [`Query.start`](https://js2me.github.io/mobx-tanstack-query/api/Query.html#start-params). The **argument** is **not** the TanStack “start params” object from the base `Query` docs (partial observer options); internally, `EndpointQuery` maps your params with **`buildOptionsFromParams`** (`enabled` + `queryKey`) before calling `super.start(…)`.

```ts
const query = getFruits.toQuery({ params: null }); // disabled until params exist

await query.start({ query: { limit: 20 } });
```

### `refetch()`

If **`params`** is **falsy** (query disabled by design), **`refetch()`** resolves immediately with the **current** observer result and **does not** hit the network. Once `params` are valid, behavior matches the base `Query`.

### `queryClient` override

Constructor options may set **`queryClient`** to an [`EndpointQueryClient`](/endpoint-query-client/index.html) other than the one bound to the endpoint—typed as **`EndpointQueryClient`**, not the generic TanStack client, so invalidations and filters can use **endpoint-aware** metadata.

### `meta` enrichment

Any **`meta`** you pass is merged with the payload from **`endpoint.toQueryMeta()`** (`operationId`, `path`, `tags`, `endpointId`, `endpointQuery: true`, …). That is what **`EndpointQueryClient`** and tooling use to target queries by endpoint.

### Static `enabled: false`

If you pass a **plain object** (not the factory form) with **`enabled: false`**, the query stays **disabled** even when `params` would otherwise satisfy `requiredParams`. (Reactive/factory forms rely on merged dynamic options; use the same pattern as a normal `Query` if you need `enabled` to flip from observables.)

## Other API

:::: tip What stays on `Query`
Endpoint-layer fields (`params`, `uniqKey`, `transform`, `response`, endpoint-specific `update` / `start` / `refetch` behavior, `EndpointQueryClient`, enriched `meta`) are **not** on the stock [`Query`](https://js2me.github.io/mobx-tanstack-query/api/Query) from **mobx-tanstack-query**.

For **`enabled`** (unless you use the static hard-disable above), **`staleTime`**, **`select`**, **`onDone`**, **`options(query) => …`**, and the rest of the observer surface, use the same options as [`Query`](https://js2me.github.io/mobx-tanstack-query/api/Query). See the [**mobx-tanstack-query** docs](https://js2me.github.io/mobx-tanstack-query/).
::::

## Extras  

#### `ToEndpointQuery` type  

This type allows you to convert `Endpoint` to `EndpointQuery` type.   
It might be helpful if you are using some factory method to create endpoint queries.  

Example:  
```ts
import { ToEndpointQuery } from 'mobx-tanstack-query-api';
import { getFruits } from "@/shared/api/__generated__";

type GetFruitsQueryType = ToEndpointQuery<typeof getFruits>;
```