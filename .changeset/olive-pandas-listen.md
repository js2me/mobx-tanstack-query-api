---
"mobx-tanstack-query-api": patch
---

stop relying on `crypto.randomUUID()` for `endpointId` so endpoints work in insecure contexts (plain HTTP)
