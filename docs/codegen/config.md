# Configuration file   

This project is requires a configuration file.   
You need to create a configuration file named as `api-codegen.config.{ts|js|mjs|json}`. Recommends to create `api-codegen.config.ts` or you can create a configuration file with your own name, but you need to use `-c`, `--config` option in cli.   

::: tip use `defineConfig` function
This function is exports from `mobx-tanstack-query-api/cli` import. It adds typings for your configuration file.  
:::

```ts
import { defineConfig } from "mobx-tanstack-query-api/cli";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  input: 'path-or-url-to-openapi.{yaml|json}' | object,
  output: 'path-to-output-directory',
})
```

## Multiple configs   

You can pass multiple configs to `defineConfig` function   

```ts
import { defineConfig } from "mobx-tanstack-query-api/cli";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([
  {
    input: 'path-or-url-to-openapi.{yaml|json}' | object,
    output: 'path-to-output-directory',
  },
  {
    input: 'path-or-url-to-openapi.{yaml|json}' | object,
    output: 'path-to-output-directory',
  },
  {
    input: 'path-or-url-to-openapi.{yaml|json}' | object,
    output: 'path-to-output-directory',
  }
])
```


## Options   


#### `input`   

Required input path or url to OpenAPI/Swagger file or OpenAPI/Swagger object.  
Sometimes will be helpful to use [`fetchSchemaRequestOptions`](#fetchschemarequestoptions) to fetch OpenAPI/Swagger file with some custom request options (like auth headers).   

```ts
input: 'https://gitlab.com/api/v4/openapi.json'
```

#### `mixinInput`   

Additional input swagger schema or spec which allows to mix two swagger files.   
This might be helpful if you need to merge two OpenAPI/Swagger files.  


#### `output`   

Required output directory path.   

#### `fetchSchemaRequestOptions`  

Optional fetch options to fetch OpenAPI/Swagger file.   
Using this option you can add auth headers, etc.   
Example:  
```ts
fetchSchemaRequestOptions: {
  headers: {
    'PRIVATE-TOKEN': `GitlabToken`,
    'Authorization': `Basic ${Buffer.from('js2me:qwerty').toString('base64')}`,
  }
}
```

#### `httpClient`   

This is import property configuration for all your generated endpoints.   
Default value: `'builtin'` which means use built-in http client.  
You can override it to use your own http client.   

Sometime this is useful if you need to customize fetch api behavior or add your own initialization for `HttpClient`.   

Example:  

Create your own file with http client:   

_src/shared/api/http-client.ts_
```ts{3}
import { HttpClient } from 'mobx-tanstack-query-api';

export const myExportHttpClientName = new HttpClient({
  baseUrl: 'https://mydomainforapi.com',
})
```


_src/api-codegen.config.ts_
```ts{2}
httpClient: {
  exportName: 'myExportHttpClientName',
  path: '@/shared/api/http-client',
}
```
So you will in generated endpoint files this code lines:   

_src/shared/api/\_\_generated\_\__
```ts{1,27}
import { myExportHttpClientName } from "@/shared/api/http-client";
import {
  Endpoint,
  HttpResponse,
  RequestParams,
} from "mobx-tanstack-query-api";
...
export const getMyData = new Endpoint<
  HttpResponse<GetMyDataDC, GetMyDataError>,
  GetMyDataParams,
  any
>(
  {
    params: ({ query, requestParams }) => ({
      path: `/api/v1/get-my-data`,
      method: "GET",
      query: query,
      ...requestParams,
    }),
    requiredParams: [],
    operationId: "getMyData",
    path: ["api", "v1", "get-my-data"],
    tags: [Tag.MyData],
    meta: {} as any,
  },
  queryClient,
  myExportHttpClientName,
);
```

#### `queryClient`   

Same as [`httpClient`](#httpclient) but for `queryClient`.   

This is import property configuration for all your generated endpoints.   
Default value: `'builtin'` which means use built-in Tanstack's query client.  
You can override it to use your own query client.   

Sometime this is useful if you need to add configuration for `EndpointQueryClient`  

Example:  

Create your own file with query client:   

_src/shared/api/query-client.ts_
```ts{3}
import { EndpointQueryClient } from 'mobx-tanstack-query-api';

export const myQueryClient = new EndpointQueryClient({
  defaultOptions: {
    queries: {
      enableOnDemand: true,
      throwOnError: true,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 0,
      retry: false,
    },
    mutations: {
      throwOnError: true,
    },
  },
})
```


_src/api-codegen.config.ts_
```ts{2}
queryClient: {
  exportName: 'myQueryClient',
  path: '@/shared/api/query-client',
}
```
So you will in generated endpoint files this code lines:   

_src/shared/api/\_\_generated\_\__
```ts{1,26}
import { myQueryClient } from "@/shared/api/query-client";
import {
  Endpoint,
  HttpResponse,
  RequestParams,
} from "mobx-tanstack-query-api";
...
export const getMyData = new Endpoint<
  HttpResponse<GetMyDataDC, GetMyDataError>,
  GetMyDataParams,
  any
>(
  {
    params: ({ query, requestParams }) => ({
      path: `/api/v1/get-my-data`,
      method: "GET",
      query: query,
      ...requestParams,
    }),
    requiredParams: [],
    operationId: "getMyData",
    path: ["api", "v1", "get-my-data"],
    tags: [Tag.MyData],
    meta: {} as any,
  },
  myQueryClient,
  httpClient,
);
```

#### `endpoint`  

Same as [`queryClient`](#queryclient), [`httpClient`](#httpclient) but for `Endpoint`.   

```ts{1,3}
import { MyEndpoint } from "@/shared/api/my-endpoint";
...
export const getMyData = new MyEndpoint<
...
```


#### `filterEndpoints`   

This option is needed to filter endpoints.  
You can pass string or array of strings or regular expression which will be comparing with `Endpoint.operationId`.  
Also you can pass function to manual filter endpoints.   

Example:  
```ts
filterEndpoints: (endpoint) => 
  endpoint.raw.operationId !== 'getMyData' &&
  !endpont.raw.route.startsWith('/my/another/data')
```

#### `addPathSegmentToRouteName`   

This option is needed to add path segment to route name.  
Default: `false`  
Examples:  
```ts
// operationId: 'getById'
// path: '/api/v1/users/1'
addPathSegmentToRouteName: true, // means add 0 (api) path segment
```
output will be:   
```ts
export const apiGetById = new Endpoint<...>
// [api][getById]
```

```ts
// operationId: 'getById'
// path: '/api/v1/users/1'
addPathSegmentToRouteName: 1, // means add 1 (v1) path segment
```
output will be:   
```ts
export const v1GetById = new Endpoint<...>
// [v1][getById]
```

::: tip If you need to format route name better to use [`formatEndpointName`](#formatendpointname)
:::

#### `otherCodegenParams`   

Other codegen params for `swagger-typescript-api` codegen.   
See [swagger-typescript-api](https://github.com/acacode/swagger-typescript-api) for more info.   

#### `filterTypes`   

This options is needed to filter all generated types from swagger schema.   
It might be helpful if you need only specific interfaces in output.   

Example:   
_Swagger files have 3 types: `DataDC`, `FruitsDC`, `MemeDC`_   
_But we need only `DataDC` in output_  

```ts
filterTypes: (type) => type.name !== 'DataDC'
```


#### `filterGroups`   

This option is needed to filter endpoint groups.   
You can pass string or array of strings or regular expression which will be comparing with group name.   
Also you can pass function to manual filter endpoint groups.   


#### `namespace`   

Collect all exports into single namespace.   
Can be helpful if you work with multiple backends.  

Example:
without namespace:

```ts
export * from "./endpoints";
export * from "./data-contracts";
```

with namespace:

```ts
export * as namespaceName from "./__exports"; // exports like above
```

```ts
namespaceName.login.toMutation()
```

Example:   
```ts
namespace: 'api'
```

#### `requestPathPrefix`   

This option is allow to add path prefix to endpoint request path   

Example:   
```ts
requestPathPrefix: '/__super_api_prefix'
```
```ts{4,11}
export const getMyData = new Endpoint<...>(
  {
    params: ({ query, requestParams }) => ({
      path: `/__super_api_prefix/api/v1/get-my-data`,
      method: "GET",
      query: query,
      ...requestParams,
    }),
    requiredParams: [],
    operationId: "getMyData",
    path: ["__super_api_prefix", "api", "v1", "get-my-data"],
    tags: [Tag.MyData],
    meta: {} as any,
  },
  myQueryClient,
  httpClient,
);
```

#### `requestPathSuffix`   

This option is allow to add path suffix to endpoint request path   

Example:   
```ts
requestPathSuffix: '/__super_api_fx'
```
```ts{4,11}
export const getMyData = new Endpoint<...>(
  {
    params: ({ query, requestParams }) => ({
      path: `/api/v1/get-my-data/__super_api_fx`,
      method: "GET",
      query: query,
      ...requestParams,
    }),
    requiredParams: [],
    operationId: "getMyData",
    path: ["api", "v1", "get-my-data", "__super_api_fx"],
    tags: [Tag.MyData],
    meta: {} as any,
  },
  myQueryClient,
  httpClient,
);
```


#### `removeUnusedTypes`   

This option is removes all data contracts which are not used in any endpoint.   
Default: `false`  

::: info This is slow operation
:::

Example:  
```ts
removeUnusedTypes: true
// or 
removeUnusedTypes: {
  keepTypes: ['MySuperType']
}
```


#### `formatEndpointName`   

This option is allow to format endpoint name.

Example:  
```ts
formatEndpointName: (endpointName, endpointData) => {
  return `${endpointName}Endpoint`;
}
// `getMyData` -> `getMyDataEndpoint`
```


#### `groupBy`   

This option is allow to group endpoints into object.    
Default: `false`  

You can group endpoints by:    
- `tag` - endpoint tag (first tag)   
- `tag-{number}` - specific endpoint tag index number  
- `path-segment` - endpoint path segment (first path segment)   
- `path-segment-{number}` - specific endpoint path segment index number  
- custom behavior with function     

Example:  
```ts
groupBy: 'tag'
```
```ts
groupBy: endpoint =>
  endpoint.raw.route.includes('users') ? 'users' : 'other'
```  
```ts
groupBy: endpoint => {
  if (endpoint.raw && 'x-ogen-operation-group' in endpoint.raw) {
    return endpoint.raw['x-ogen-operation-group'];
  }

  return endpoint.tags?.[0] ?? 'other';
}
```


#### `formatExportGroupName`   

This option is allow to format endpoints group export name.  

Example:  
```ts
formatExportGroupName: (groupName) => {
  return `${groupName}Api`;
}
```


#### `outputType`   

This option is allow to choose output type.   
Default: `one-endpoint-per-file`   

Variants:   

-  `one-endpoint-per-file` - one file per endpoint   

Example with groups:   
```
* outputdir
*  groupname
*    index.ts
*    endpoints
*      index.ts
*      get-endpoint-1.ts
*      get-endpoint-n.ts
```
Example without groups:   
```
* outputdir
*  index.ts
*  endpoints
*    index.ts
*    get-endpoint-1.ts
*    get-endpoint-n.ts
```

-  `endpoints-per-file` - all endpoints in one file
Example with groups:
```
* outputdir
*  groupname
*    index.ts
*    endpoints.ts
```
Example without groups:   
```
* outputdir
*  index.ts
*  endpoints.ts
```


#### `getRequestMeta`   
This option is allow to add some meta information for endpoint request.   
Can be helpful if you need customize base url for http request.  

Example:   
```ts{2}
getRequestMeta: () => ({
  tmplData: `{ service: 'auth' }`,
}),
```
```ts{10}
export const getFruits = new Endpoint<
  HttpResponse<GetFruitsDataDC, GetRolesErrorDC>,
  GetFruitsParams,
  any
>(
  {
    params: ({ query, requestParams }) => ({
      path: `/fruits`,
      method: "GET",
      meta: { service: 'auth' },
      query: query,
      secure: true,
      ...requestParams,
    }),
  },
  ...
  queryClient,
  httpClient,
);
```

#### `getEndpointMeta`   
This option is allow to add some meta information for endpoint.   


Example:   

Example:   
```ts{2}
getEndpointMeta: () => ({
  typeName: `{ somedata: string }`,
  tmplData: `{ somedata: '123' }`,
}),
```
```ts{4,17}
export const getFruits = new Endpoint<
  HttpResponse<GetFruitsDataDC, GetRolesErrorDC>,
  GetFruitsParams,
  { somedata: string }
>(
  {
    params: ({ query, requestParams }) => ({
      path: `/fruits`,
      method: "GET",
      query: query,
      secure: true,
      ...requestParams,
    }),
    operationId: "getFruits",
    path: ["fruits"],
    tags: [Tag.Frutis],
    meta: { somedata: '123' },
  },
  ...
  queryClient,
  httpClient,
);


getFruits.meta.somedata; // '123'
```

#### `noMetaInfo`  

Allows to disable generation `meta-info.ts` file   
