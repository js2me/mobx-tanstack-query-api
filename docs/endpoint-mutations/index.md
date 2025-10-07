# Endpoint mutations     

```ts
class EndpointMutation<> {}
```

This is `mobx-tanstack-query` Mutation wrapper for `Endpoint` object.  

Example:  
```ts
import { yourEndpoint } from "@/shared/api/__generated__";

export const youEndpointMutation = yourEndpoint.toMutation({})

console.log(youEndpointMutation.isPending, youEndpointMutation.data);
``` 

## Extras  

#### `ToEndpointMutation` type  

This type allows you to convert `Endpoint` to `EndpointMutation` type.   
It might be helpful if you are using some factory method to create endpoint mutation.  

Example:  
```ts
import { ToEndpointMutation } from 'mobx-tanstack-query-api';
import { addFruit } from "@/shared/api/__generated__";

type AddFruitMutationType = ToEndpointMutation<typeof addFruit>;
```