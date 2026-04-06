---
"mobx-tanstack-query-api": minor
---

Add `overrideRequestParams` codegen option: a static `Partial<FullRequestParams>` or a `(routeInfo: RouteBaseInfo) => …` factory evaluated at codegen time. The result is spread into each generated endpoint `params` return value before `...requestParams`, so runtime `requestParams` can still override those keys. Falsy values emit nothing.
