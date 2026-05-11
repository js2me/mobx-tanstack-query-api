---
"mobx-tanstack-query-api": minor
---

Refactor endpoint query runtime: remove internal MobX `reaction` / `lazyObserve` from `EndpointQuery` and `EndpointInfiniteQuery`. State (`params`, `uniqKey`, dynamic options, response) is synced via a compact `_sync` model inside the `options` callback; the public `response` field is updated directly—fewer redundant writes and reaction-loop risk, and more reliable initialization order in derived classes (including function `queryOptions` and structural comparers).
