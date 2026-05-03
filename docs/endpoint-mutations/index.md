# Endpoint mutations

[`Endpoint.toMutation(options)`](/endpoints/index.html#tomutation) builds a mutation object for that HTTP operation. **`options` is required** (`{}` is enough).

```ts
import { yourEndpoint } from "@/shared/api/__generated__";

export const yourEndpointMutation = yourEndpoint.toMutation({});

console.log(yourEndpointMutation.isPending, yourEndpointMutation.data);
```

The endpoint owns the request—you do not pass a custom request function. **`requestParams`** on the payload is merged with the abort **`signal`**.

## API

### `mutate` / `start`

Pass the payload your generated operation expects. **`mutate`** and **`start`** return a promise.

```ts
await addFruit.mutate({ body: { name: 'Apple' } });
```

### `queryClient`

Optional **[`EndpointQueryClient`](/endpoint-query-client/index.html)**; otherwise [`Endpoint.queryClient`](/endpoints/index.html#queryclient) is used.

<a id="optionsinvalidateendpoints"></a>

### `invalidateEndpoints`

Same role as [`invalidateEndpoints`](/endpoint-query-client/index.html#invalidateendpoints) on **`EndpointQueryClient`**: the same filters and shorthand values apply, but here they run only **after the mutation finishes successfully**.

```ts
// After success: invalidate peers in the same OpenAPI group, or by shared tags if there is no group
addFruit.toMutation({ invalidateEndpoints: true });

addFruit.toMutation({ invalidateEndpoints: 'by-group' });

addFruit.toMutation({ invalidateEndpoints: 'by-tag' });

// Same filter object you would pass to EndpointQueryClient.invalidateEndpoints
addFruit.toMutation({
  invalidateEndpoints: {
    operationId: 'getFruits',
  },
});
```

If **`invalidateEndpoints`** is not set on **`toMutation`**, the value read from **`endpoint.presets.mutations.invalidateQueries`** is used as **`invalidateEndpoints`** (the preset key says *queries* for historical reasons, but it configures this endpoint invalidation—see [**presets**](/endpoints/index.html#presets)).

<a id="optionstransform"></a>

### `transform`

Optional function over the **full HTTP response**; its return value becomes the mutation result **`data`**. If omitted, the response **body** is used.

## Extras

**`ToEndpointMutation`** (from **`mobx-tanstack-query-api`**) — infer the mutation wrapper type from an endpoint in helpers or factories.
