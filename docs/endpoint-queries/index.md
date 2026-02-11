# Endpoint queries     

```ts
class EndpointQuery<> {}
```

This is `mobx-tanstack-query` [`Query`](https://js2me.github.io/mobx-tanstack-query/api/Query) wrapper for `Endpoint` object.  

Example:  
```ts
import { yourEndpoint } from "@/shared/api/__generated__";

export const yourEndpointQuery = yourEndpoint.toQuery({})

console.log(yourEndpointQuery.isLoading, yourEndpointQuery.data);
``` 

## API

### params

Current endpoint params used to build query key and to detect query enabled state.

```ts
const fruitsQuery = getFruits.toQuery({
  params: { query: { limit: 10 } },
});

console.log(fruitsQuery.params); // { query: { limit: 10 } }
```

### response

Raw HTTP response returned by endpoint request.

```ts
const fruitsQuery = getFruits.toQuery({
  params: { query: { limit: 10 } },
});

await fruitsQuery.refetch();

console.log(fruitsQuery.response?.status); // e.g. 200
console.log(fruitsQuery.response?.data); // same payload source for query result
```


## Differences between `EndpointQuery` and [`Query`](https://js2me.github.io/mobx-tanstack-query/api/Query)   

#### `params`   
This is the input params for `EndpointQuery` which are needed to enable or disable query.   
Passing **any falsy** value in `params` property will disable the query, otherwise query will be enabled.  

_Examples with disabled queries:_   
```ts
const query = getFruits.toQuery(() => ({
  params: null,
}));
const query = getFruits.toQuery(() => ({
  params: '',
}));
const query = getFruits.toQuery(() => ({
  params: false,
}));
const query = getFruits.toQuery(() => ({
  params: undefined,
}));
const query = getFruits.toQuery({
  params: 0,
});
const query = getFruits.toQuery({
  params: () => 0,
});
```

_Examples with enabled queries:_   
```ts
const query = getFruits.toQuery(() => ({
  params: {},
}));
const query = getFruits.toQuery(() => ({
  params: { query: {} },
}));
const query = getFruits.toQuery({
  params: { query: {} },
});
const query = getFruits.toQuery({
  params: () => ({ query: {} }),
});
```


:::tip If you will not write this property in options then query will be enabled only if query do not have any **required** params
:::

```ts{1,16}
const query = getFruits.toQuery({});

// where getFruits
export const getFruits = new Endpoint<
  HttpResponse<..., ...>,
  ...,
  any
>(
  {
    params: ({ query, requestParams }) => ({
      path: `/api/v1/fruits`,
      method: "GET",
      query: query,
      ...requestParams,
    }),
    requiredParams: [],
    operationId: "getFruits",
    path: ["api", "v1", "services"],
    tags: [Tag.Fruits],
    meta: {} as any,
  },
  queryClient,
  httpClient,
);
```


#### `update()`   

This method is also has `params` property which is needed to enable or disable query.  

```ts
const query = getFruits.toQuery({});

query.update({ params: {} });
```




## Extras  

#### `ToEndpointQuery` type  

This type allows you to convert `Endpoint` to `EndpointQuery` type.   
It might be helpful if you are using some factory method to create endpoint queries.  

Example:  
```ts
import { ToEndpointQuery } from 'mobx-tanstack-query-api';
import { getFruits } from "@/shared/api/__generated__";

type GetFruitsQueryType = ToEndpointQuery<typeof getFruits>;
```