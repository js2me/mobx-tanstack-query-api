# Endpoints  

This class is a wrapper for your http request.   
Class instance is also executable function, so you can call it directly.   

Example:  
```ts
import { Endpoint } from "mobx-tanstack-query-api";

export const getShotguns = new Endpoint<...>({...});

getShotguns().then(console.log);
``` 


## Transformation to query    
You can transform endpoint to query using `.toQuery()` method.   

Example:  
```ts
const getShotgunsQuery = getShotguns.toQuery({
  params: null,
});

getShotgunsQuery.start({});
```

## Transformation to mutation    
You can transform endpoint to mutation using `.toMutation()` method.   

Example:  
```ts
const getShotgunsMutation = getShotguns.toMutation({});

getShotgunsMutation.start({});
```