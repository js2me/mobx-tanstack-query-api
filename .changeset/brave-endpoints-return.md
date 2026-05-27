---
"mobx-tanstack-query-api": patch
---

Return the promise from `Endpoint.invalidateQuery()` so callers can `await` invalidation like with `queryClient.invalidateQueries()`.
