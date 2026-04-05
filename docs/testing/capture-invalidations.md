# `captureInvalidations`

Spies on **`queryClient.invalidateQueries`**, records each **`(filters, options)`**, then forwards to the real method so invalidation still runs. Use the **same** **`queryClient`** instance as in your app / codegen setup.

The returned handle has **`calls`**, **`last`**, **`waitNext()`**, **`restore()`**, **`queryClient`** (the instance you passed in), and **`mock`** (the Vitest spy on **`invalidateQueries`**). Optional **`abortSignal`** as the second argument cleans up when the test is cancelled.

**`filters.queryKey`** is the full TanStack **`queryKey`** — assert with **`toContainEqual`** on the pieces you care about, not a full deep **`toEqual`** on the whole array.

**Example — assert `invalidateQuery` filters:**

```ts
import { EndpointQueryClient } from "mobx-tanstack-query-api";
import { captureInvalidations } from "mobx-tanstack-query-api/testing";

const queryClient = new EndpointQueryClient();
const cap = captureInvalidations(queryClient);

getItem.invalidateQuery({ id: 7 });

expect(cap.last?.filters.exact).toBe(true);
expect(cap.last?.filters.queryKey).toContainEqual("getItem");
expect(cap.last?.filters.queryKey).toContainEqual({ id: 7 });
cap.restore();
```

**Example — wait for the next invalidation:**

```ts
import { EndpointQueryClient } from "mobx-tanstack-query-api";
import { captureInvalidations } from "mobx-tanstack-query-api/testing";

const queryClient = new EndpointQueryClient();
const cap = captureInvalidations(queryClient);
const next = cap.waitNext();
getItem.invalidateQuery({ id: 3 });
const recorded = await next;
expect(recorded.filters.queryKey).toContainEqual("getItem");
expect(recorded.filters.queryKey).toContainEqual({ id: 3 });
cap.restore();
```
