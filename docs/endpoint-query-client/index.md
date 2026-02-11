# EndpointQueryClient   

Class that extends `QueryClient` and gives a bit more control over endpoint queries and mutations.  

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
