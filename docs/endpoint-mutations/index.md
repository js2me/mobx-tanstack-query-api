# Endpoint mutations     

```ts
class EndpointMutation<> {}
```

This is `mobx-tanstack-query` Mutation wrapper for `Endpoint` object.  

Example:  
```ts
import { yourEndpoint } from "@/shared/api/__generated__";

export const yourEndpointQuery = yourEndpoint.toMutation({})

console.log(yourEndpointQuery.isPending, yourEndpointQuery.data);
``` 
