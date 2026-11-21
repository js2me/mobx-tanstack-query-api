---
"mobx-tanstack-query-api": minor
---

Add support for `mobx-tanstack-query` 8 alongside the existing `^7.4.0` range. With the v8 defaults, endpoint queries and infinite queries preserve the `data` reference when a refetch returns equal JSON data. Set `structuralSharing: false` on a query or in `EndpointQueryClient` query defaults to keep the previous behavior.
