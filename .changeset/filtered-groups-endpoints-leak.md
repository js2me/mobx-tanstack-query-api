---
"mobx-tanstack-query-api": patch
---

fixed `filterGroups` and `filterEndpoints` leaking filtered-out routes/types into generated output:
- `filterGroups`: operation-level alias types (e.g. `Op*DataDC`, `Op*ErrorDC`) of routes from filtered-out groups no longer appear in `data-contracts.ts`
- `filterEndpoints` with `outputType: 'endpoints-per-file'` (with or without `groupBy`): filtered-out endpoints are no longer emitted into `endpoints.ts`, and their operation-level alias types no longer leak into `data-contracts.ts`
