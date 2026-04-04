# `captureInvalidations`

```ts
import type { EndpointQueryClient } from "mobx-tanstack-query-api";

function captureInvalidations(
  queryClient: EndpointQueryClient,
  abortSignal?: AbortSignal,
): CaptureInvalidationsHandle;
```

Installs a Vitest **spy** on **`queryClient.invalidateQueries`**: every **`(filters, options)`** is recorded, then the call is forwarded to the real implementation (cache invalidation runs as usual).

Use the **same** **`queryClient`** when wiring **codegen-generated** endpoints (see [Getting started](/introduction/getting-started.html)), so **`getItem.invalidateQuery(...)`** goes through this client.

Optional **`abortSignal`**: pass Vitest’s test **`signal`** so **`restore()`** runs when the test is **cancelled**. **`restore()`** remains safe to call explicitly afterward (idempotent).

The handle exposes **`calls`**, **`last`**, **`waitNext()`**, **`queryClient`** (the instance you passed), the Vitest **`mock`** (the spy), and **`restore()`** (**`mock.mockRestore()`**, safe to call multiple times, including after **`abortSignal`**).

**`filters.queryKey`** is the full TanStack **`queryKey`** array (path segments, **`operationId`**, params object, etc.). Assert specific parts with **`toContainEqual`**, not **`toEqual([{ id }])`**.

**Example — assert `invalidateQuery` filters:**

Below, **`getItem`** stands for a generated endpoint export; **`queryClient`** must be the same instance passed to **`captureInvalidations`**.

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
