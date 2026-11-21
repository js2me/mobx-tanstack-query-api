---
"mobx-tanstack-query-api": minor
---

Upgrade to `mobx-tanstack-query` 8. With the default settings, endpoint queries and infinite queries preserve the `data` reference when a refetch returns equal JSON data. Set `structuralSharing: false` on a query or in `EndpointQueryClient` query defaults to keep the previous behavior.
