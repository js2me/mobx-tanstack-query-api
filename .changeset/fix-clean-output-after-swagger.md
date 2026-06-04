---
"mobx-tanstack-query-api": patch
---

Do not wipe `output` when OpenAPI parsing fails; run `cleanOutput` cleanup only after swagger succeeds.
