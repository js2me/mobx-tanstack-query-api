---
"mobx-tanstack-query-api": minor
---

Infinite queries: when `mergePageParam` is a string shortcut (`'params' | 'body' | 'query' | 'headers'`), `pageParam` must be an object; otherwise a documented error is thrown (minified `#1` in production). Infinite-query docs now include an errors section with examples; tests expanded.
