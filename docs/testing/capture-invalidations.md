# `captureInvalidations`

```ts
function captureInvalidations(): CaptureInvalidationsHandle;
```

Returns a minimal **`EndpointQueryClient`** stub whose **`invalidateQueries`** records every **`(filters, options)`** tuple.

Pass **`cap.queryClient`** into your **test wiring** as the same **`queryClient`** your **codegen-generated** endpoints use (see [Getting started](/introduction/getting-started.html)), so calls like **`getItem.invalidateQuery(...)`** go through this stub.

The handle exposes **`calls`**, **`last`**, **`waitNext()`**, the underlying Vitest **`mock`**, and **`restore()`** (calls **`mock.mockRestore()`**).

This stub implements only **`invalidateQueries`**. For tests that need a real cache or **`invalidateEndpoints`**, use a real **`EndpointQueryClient`** and **`vi.spyOn(client, 'invalidateQueries')`** instead.

**`filters.queryKey`** is the full TanStack **`queryKey`** array (path segments, **`operationId`**, params object, etc.). Assert specific parts with **`toContainEqual`**, not **`toEqual([{ id }])`**.

**Example — assert `invalidateQuery` filters:**

Below, **`getItem`** stands for a generated endpoint export. It must use **`cap.queryClient`**.

```ts
import { captureInvalidations } from "mobx-tanstack-query-api/testing";

const cap = captureInvalidations();

getItem.invalidateQuery({ id: 7 });

expect(cap.last?.filters.exact).toBe(true);
expect(cap.last?.filters.queryKey).toContainEqual("getItem");
expect(cap.last?.filters.queryKey).toContainEqual({ id: 7 });
cap.restore();
```

**Example — wait for the next invalidation:**

```ts
import { captureInvalidations } from "mobx-tanstack-query-api/testing";

const cap = captureInvalidations();
const next = cap.waitNext();
getItem.invalidateQuery({ id: 3 });
const recorded = await next;
expect(recorded.filters.queryKey).toContainEqual("getItem");
expect(recorded.filters.queryKey).toContainEqual({ id: 3 });
cap.restore();
```
