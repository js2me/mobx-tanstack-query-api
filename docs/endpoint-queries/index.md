# Endpoint queries     

```ts
class EndpointQuery<> {}
```

This is `mobx-tanstack-query` Query wrapper for `Endpoint` object.  

Example:  
```ts
import { yourEndpoint } from "@/shared/api/__generated__";

export const yourEndpointQuery = yourEndpoint.toQuery({})

console.log(yourEndpointQuery.isLoading, yourEndpointQuery.data);
``` 
