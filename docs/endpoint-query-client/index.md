# EndpointQueryClient

Extends `QueryClient` from `mobx-tanstack-query` and adds helpers for invalidating queries by endpoint metadata. By default it uses TanStack’s `hashKey` as `queryKeyHashFn` so query keys behave like the core library.

```ts
import { EndpointQueryClient } from "mobx-tanstack-query-api";
```

## API

### constructor

Creates `EndpointQueryClient` with stable query key hashing by default.

### invalidateEndpoints

Invalidates endpoint queries using endpoint metadata filters:

- `endpoint` - by specific endpoint instance or list of endpoints
- `namespace` - by endpoint namespace
- `group` - by endpoint group
- `operationId` - by operation id
- `tag` - by endpoint tags
- `exclude` - exclude endpoints or tags from invalidation
- `predicate` - custom filter callback
