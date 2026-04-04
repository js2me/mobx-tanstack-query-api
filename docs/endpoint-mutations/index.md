# Endpoint mutations

```ts
class EndpointMutation<> {}
```

This is the [`Mutation`](https://js2me.github.io/mobx-tanstack-query/api/Mutation) class from `mobx-tanstack-query`, wrapped around an `Endpoint` instance.

## API

### constructor

Creates `EndpointMutation` from endpoint and mutation options.

### options.invalidateEndpoints

After a successful mutation, `EndpointQueryClient.invalidateEndpoints` runs when this option is set:

- `true` — if the endpoint has a `group`, invalidates by group; otherwise invalidates by its `tags`
- `'by-group'` — invalidates endpoints in the same `group`
- `'by-tag'` — invalidates endpoints that share any of this endpoint’s tags
- an object — same shape as [`invalidateEndpoints`](/endpoint-query-client/index.html#invalidateendpoints) on `EndpointQueryClient` (filters such as `namespace`, `operationId`, `predicate`, and so on)

### options.transform

Transforms raw endpoint response to the final mutation data.


Example:

```ts
import { yourEndpoint } from "@/shared/api/__generated__";

export const yourEndpointMutation = yourEndpoint.toMutation({});

console.log(yourEndpointMutation.isPending, yourEndpointMutation.data);
```

## Extras

#### `ToEndpointMutation` type

Maps an `Endpoint` type to the corresponding `EndpointMutation` type (useful for factories and shared helpers).

Example:

```ts
import { ToEndpointMutation } from 'mobx-tanstack-query-api';
import { addFruit } from "@/shared/api/__generated__";

type AddFruitMutationType = ToEndpointMutation<typeof addFruit>;
```