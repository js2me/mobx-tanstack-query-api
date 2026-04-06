---
"mobx-tanstack-query-api": minor
---

Add `overrideRequestParams` codegen option: a static `Partial<FullRequestParams>`, a non-empty string (inserted as a TypeScript expression in `...(<expr>),`), or a `(routeInfo: RouteBaseInfo) => …` factory evaluated at codegen time. The result is spread into each generated endpoint `params` return value before `...requestParams`, so runtime `requestParams` can still override those keys. Falsy values and whitespace-only strings emit nothing.
