# Configuration file   

This project requires a configuration file.   
You need to create a configuration file named `api-codegen.config.{ts|js|mjs|json}`. It is recommended to create `api-codegen.config.ts`, or you can create a configuration file with your own name and use the `-c` or `--config` option in the CLI.   

::: tip use `defineConfig` function
This function is exported from the `mobx-tanstack-query-api/cli` package. It adds typings for your configuration file.  
:::

```ts
import { defineConfig } from "mobx-tanstack-query-api/cli";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  input: 'path-or-url-to-openapi.{yaml|json}' | object,
  output: 'path-to-output-directory',
  noBarrelFiles: true,
  removeUnusedTypes: true,
  outputType: 'one-endpoint-per-file',
})
```

::: tip Falsy arguments to `defineConfig`
Each rest argument to `defineConfig(...)` is typed as **`MaybeFalsy<GenerateQueryApiParams | MaybeFalsy<GenerateQueryApiParams>[]>`**. Falsy values (`undefined`, `null`, `''`, `false`, `0`) are dropped before flattening — they never reach the returned array. You can safely pass conditional fragments such as `defineConfig(shared, flag && extraBlock, maybeArray)` without wrapping them in an `if`.
:::

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
    removeUnusedTypes: true,
  },
  {
    input: 'path-or-url-to-openapi.{yaml|json}' | object,
    output: 'path-to-output-directory',
  },
  {
    input: 'path-or-url-to-openapi.{yaml|json}' | object,
    output: 'path-to-output-directory',
    outputType: 'one-endpoint-per-file',
  }
])
```

::: tip Conditional entries in an array
If an item uses a **falsy** `input` (see [`input`](#input)), that object is skipped by **`generateApi`** (including when the CLI runs `generateApi(defineConfig(...))`). `defineConfig` itself still returns it in the flattened array; only codegen ignores it.
:::


## Options   


### `input`   

Type: **`MaybeFalsy<string | AnyObject>`** — either a path or URL to an OpenAPI/Swagger file, or an OpenAPI/Swagger object inlined in the config.

**Falsy values** (`undefined`, `null`, `''`, `false`, `0`) mean the **entire configuration object is skipped by `generateApi`** (they are not codegen’d and their `output` is **not** included in the pre-codegen disk cleanup for the batch). `defineConfig` does not remove these entries; filtering happens when you call `generateApi`.

Any other value (non-empty string or object, including `{}`) is treated as active input.

Sometimes it is helpful to use [`fetchSchemaRequestOptions`](#fetchschemarequestoptions) to fetch an OpenAPI/Swagger file with custom request options (for example auth headers).

```ts
input: 'https://gitlab.com/api/v4/openapi.json'
```

### `mixinInput`   

Additional input swagger schema or spec which allows to mix two swagger files.   
This might be helpful if you need to merge two OpenAPI/Swagger files.  


### `output`   

Required output directory path.   

### `dataContractTypeSuffix`

Suffix for generated data-contract type names.
Default: `DC`.

Use this when you want to replace the default `*DC` naming with another suffix (for example `*DTO`).

Example:
```ts
dataContractTypeSuffix: 'DTO'
```

_output example (names):_ `GetUserRequestDTO`, `GetUserResponseDTO`, `GetUserErrorDTO`

### `fetchSchemaRequestOptions`  

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

### `httpClient`   

This is an important property configuration for all your generated endpoints.   
Default value: `'builtin'` which means use built-in http client.  
You can override it to use your own http client.   

Sometimes this is useful if you need to customize fetch api behavior or add your own initialization for `HttpClient`.   

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
So in generated endpoint files you will see these code lines:   

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
    meta: {},
  },
  queryClient,
  myExportHttpClientName,
);
```

### `queryClient`   

Same as [`httpClient`](#httpclient) but for `queryClient`.   

This is an important property configuration for all your generated endpoints.   
Default value: `'builtin'` which means use built-in Tanstack's query client.  
You can override it to use your own query client.   

Sometimes this is useful if you need to add configuration for `EndpointQueryClient`  

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
So in generated endpoint files you will see these code lines:   

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
    meta: {},
  },
  myQueryClient,
  httpClient,
);
```

### `endpoint`  

Same as [`queryClient`](#queryclient), [`httpClient`](#httpclient) but for `Endpoint`.   

```ts{1,3}
import { MyEndpoint } from "@/shared/api/my-endpoint";
...
export const getMyData = new MyEndpoint<
...
```


### `filterEndpoints`   

This option is used to filter endpoints.  
You can pass string or array of strings or regular expression which will be compared with `Endpoint.operationId`.  
You can also pass a function to manually filter endpoints.   

Example:  
```ts
filterEndpoints: (endpoint) => 
  endpoint.raw.operationId !== 'getMyData' &&
  !endpoint.raw.route.startsWith('/my/another/data')
```

### `addPathSegmentToRouteName`   

This option is used to add path segment to route name.  
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

### `otherCodegenParams`   

Other codegen params for `swagger-typescript-api` codegen.   
See [swagger-typescript-api](https://github.com/acacode/swagger-typescript-api) for more info.   

### `filterTypes`   

This option is used to filter all generated types from swagger schema.   
It might be helpful if you need only specific interfaces in output.   

Example:   
_Swagger files have 3 types: `DataDC`, `FruitsDC`, `MemeDC`_   
_But we need only `DataDC` in output_  

```ts
filterTypes: (type) => type.name !== 'DataDC'
```


### `filterGroups`   

This option is used to filter endpoint groups.   
You can pass string or array of strings or regular expression which will be compared with the group name.   
You can also pass a function to manually filter endpoint groups.   


### `namespace`   

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

### `requestPathPrefix`   

This option adds a prefix to each endpoint’s request `path` string (the template literal passed to `params`, not the `path` array segments).

- **String** — inserted as-is before the OpenAPI route path (same behavior as before).
- **Function** — called once per endpoint at **codegen** time. It receives an object with `operationId`, `path`, `method`, and `contractName` (the generated endpoint contract variable base name, including the Zod endpoint suffix when applicable). Return the prefix string to use for that endpoint.

The callback argument type is exported as `RouteBaseInfo` from `mobx-tanstack-query-api/cli` (same shape as the `routeInfo` object passed to `zodContracts` `MaybeFn` options).

Example (string):   
```ts
requestPathPrefix: '/__super_api_prefix'
```

Example (function):

```ts
import type { RouteBaseInfo } from 'mobx-tanstack-query-api/cli';

requestPathPrefix: (endpoint: RouteBaseInfo) =>
  endpoint.operationId.startsWith('admin') ? '/admin-api' : '/public-api',
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
    meta: {},
  },
  myQueryClient,
  httpClient,
);
```

### `requestPathSuffix`   

This option adds a suffix after each endpoint’s request `path` string (the template literal in `params`).

- **String** — appended as-is after the OpenAPI route path.
- **Function** — same as for `requestPathPrefix`: evaluated at **codegen** time per endpoint with a `RouteBaseInfo` argument (`operationId`, `path`, `method`, `contractName`).

Example (string):   
```ts
requestPathSuffix: '/__super_api_fx'
```
_output:_  
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
    meta: {},
  },
  myQueryClient,
  httpClient,
);
```

Example (function):   
```ts
import type { RouteBaseInfo } from 'mobx-tanstack-query-api/cli';

requestPathSuffix: (endpoint: RouteBaseInfo) =>
  endpoint.method.toLowerCase() === 'post' ? '/async' : '',
```
_output:_  
```ts{4,11}
export const getMyData = new Endpoint<...>(
  {
    params: ({ query, requestParams }) => ({
      path: `/api/v1/get-my-data/async`,
      method: "POST",
      query: query,
      ...requestParams,
    }),
    requiredParams: [],
    operationId: "getMyData",
    path: ["api", "v1", "get-my-data", "async"],
    tags: [Tag.MyData],
    meta: {},
  },
  myQueryClient,
  httpClient,
);
```

### `formatBaseUrl`

Controls how OpenAPI `servers[].url` is emitted as `baseUrl` in generated endpoint `params`.

Default: `'normalize'`

Supported values:

- **`'as-is'`** — use the server URL exactly as provided in the schema.
- **`'normalize'`** — if `baseUrl` ends with `/` and generated `path` starts with `/`, remove the trailing `/` from `baseUrl`.  
  If the resulting `baseUrl` is an empty string (`''`), `baseUrl` is not emitted at all.
- **Function** — custom formatter called at **codegen** time:
  - input: `(originalBaseUrl: string, routeInfo: RouteBaseInfo)`
  - return: resulting `baseUrl` string for this endpoint

Example (`'as-is'`):

```ts
formatBaseUrl: 'as-is',
```

Example (`'normalize'`):

```ts
formatBaseUrl: 'normalize',
```

Example (function):

```ts
import type { RouteBaseInfo } from 'mobx-tanstack-query-api/cli';

formatBaseUrl: (originalBaseUrl: string, routeInfo: RouteBaseInfo) => {
  if (routeInfo.operationId.startsWith('admin')) {
    return `${originalBaseUrl}/admin`;
  }
  return originalBaseUrl;
},
```

### `chooseServer`

Optional **codegen-time** function that picks which OpenAPI [`Server Object`](https://swagger.io/specification/#server-object) supplies `url` for the generated `baseUrl` when your schema defines multiple `servers` entries.

Codegen collects three arrays (possibly empty):

| Key | Source in the OpenAPI document |
| --- | --- |
| `root` | Top-level `servers` |
| `path` | `servers` on the path item for this route |
| `route` | `servers` on the operation (swagger-typescript-api exposes this on `route.raw`) |

**Signature:** `(route, servers, swaggerSchema) => OpenApiServer \| null \| undefined`

- **`route`** — the parsed route (`ParsedRoute` from `swagger-typescript-api`).
- **`servers`** — `{ root, path, route }` as in the table above; each value is an `OpenApiServer[]`.
- **`swaggerSchema`** — the full OpenAPI root object for this run.

**Return value:** the chosen server object, or **`undefined` / `null`** to fall back to the built-in rule: use the **last** server in the operation list if non-empty, else the **last** on the path item, else the **last** at the root (same precedence as picking a single URL without this option).

The selected server’s `url` is then passed through [`formatBaseUrl`](#formatbaseurl) (default `'normalize'`) before it appears in generated code.

Example — always use the root server URL:

```ts
import type { ParsedRoute } from 'swagger-typescript-api';

chooseServer: (_route, { root }) => root.at(-1),
```

Example — prefer a staging URL when present on the operation:

```ts
chooseServer: (_route, servers) => {
  const staging = servers.route.find((s) => s.url?.includes('staging'));
  return staging ?? servers.route.at(-1);
},
```

### `overrideRequestParams`

Default values for request fields such as `secure`, `baseUrl`, or `meta` in each generated `params` function. They are emitted **before** `...requestParams`, so callers can still pass their own `requestParams` and override these keys.

You can pass:

- A **plain object** — same defaults for every endpoint in this config.
- A **function** — choose defaults per endpoint; the argument is the same `RouteBaseInfo` shape as for [`requestPathPrefix`](#requestpathprefix) (`operationId`, `path`, `method`, optional `contractName`).
- A **string** — advanced: pasted into generated code as a TypeScript expression.

Falsy values (for example `undefined`, or a whitespace-only string) add nothing to the output.

Example — shared HTTPS and base URL for all endpoints:

```ts
overrideRequestParams: {
  secure: true,
  baseUrl: 'https://api.example',
},
```

Example — different `meta` by `operationId`:

```ts
import type { RouteBaseInfo } from 'mobx-tanstack-query-api/cli';

overrideRequestParams: (route: RouteBaseInfo) =>
  route.operationId.startsWith('admin')
    ? { meta: { role: 'admin' } }
    : { meta: { role: 'public' } },
```

### `removeUnusedTypes`   

This option removes all data contracts which are not used in any endpoint.   
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


### `zodContracts`  

Enables generation of Zod contracts (`contract`) for each endpoint and (optionally) validation of input parameters and response data via `validateContract` at runtime.

Requires `zod` to be installed.

Options:

- **`true`** – generate contracts and enable validation for both `params` and `data`:

```ts
zodContracts: true
// → in the generated Endpoint config:
// contract: <...>,
// validateContract: true,
```

- **`false`** (or omitting the field) – do not generate `contract` and do not enable validation.

- **`{ validate: boolean }`** – always enable or disable validation (for both `params` and `data`) with a boolean value:

```ts
zodContracts: {
  validate: true,
}
// → validateContract: true,

zodContracts: {
  validate: false,
}
// → validateContract: false,
```

- **`{ validate: string }`** – specify an expression that will be inserted into the code as-is (e.g., enable validation only in dev environment):

```ts
zodContracts: {
  validate: "process.env.NODE_ENV === 'development'",
}
// → validateContract: process.env.NODE_ENV === 'development',
```

- **`{ validate: (contractName, routeInfo) => ... }`** – compute `validateContract` at codegen time for each endpoint. The function may return a boolean, a runtime expression string, or an object with separate `params` / `data` rules:

```ts
zodContracts: {
  validate: (contractName, routeInfo) => ({
    params: contractName.endsWith('Contract'),
    data: routeInfo.method === 'post',
  }),
}
// → validateContract: { params: true, data: true },
```

- **`{ validate: { params?: boolean | string; data?: boolean | string } }`** – control validation of `params` and `data` separately; each value can be a boolean or a string expression:

```ts
zodContracts: {
  validate: {
    // always validate input parameters
    params: true,
    // validate data only in development
    data: "process.env.NODE_ENV === 'development'",
  },
}
// → validateContract: { params: true, data: process.env.NODE_ENV === 'development' },
```

When using the object form, you can also set:

- **`suffix`** – suffix for all generated Zod contract variables. Default: `"Contract"`:

```ts
zodContracts: {
  validate: true,
  suffix: "Validator",
}
// → shared file: contracts.ts
// → export const nodePageEnvelopeValidator = ...
// → export const getBinaryReportValidator = { ... }
```

- **`appendRule`** – one field, either a string (runtime) or a function (codegen-time):
  - **string**: expression inserted as-is → `contract: <expression> ? <contractVar> : undefined` (e.g. enable contracts only in development).
  - **function** `(contractName, routeInfo) => boolean`: at codegen time, include `contract: <contractVar>` only when the function returns `true`; otherwise `contract: undefined`. The contract variable is still generated; only its inclusion in the endpoint config is conditional.

```ts
// Runtime condition (string)
zodContracts: {
  validate: true,
  appendRule: 'process.env.NODE_ENV === "development"',
}
// → contract: process.env.NODE_ENV === "development" ? getBinaryReportContract : undefined,

// Codegen-time filter (function)
zodContracts: {
  validate: true,
  appendRule: (name) => name === 'getBinaryReportContract',
}
// → contract: getBinaryReportContract,

zodContracts: {
  validate: true,
  appendRule: () => false,
}
// → contract: undefined,
```

- **`throw`** – control `throwContracts` (throw on validation errors vs. only warn):

  - **`{ throw: boolean }`** – set `throwContracts` to that boolean.
  - **`{ throw: string }`** – set `throwContracts` to an expression (inserted as-is).
  - **`{ throw: (contractName, routeInfo) => ... }`** – compute `throwContracts` at codegen time for each endpoint. The function may return a boolean, a runtime expression string, or an object with separate `params` / `data` rules.
  - **`{ throw: { params?: boolean | string; data?: boolean | string } }`** – set `throwContracts` to an object; each value is a boolean or a string expression.

```ts
zodContracts: {
  validate: true,
  throw: true,
}
// → validateContract: true, throwContracts: true,

zodContracts: {
  validate: { params: true, data: true },
  throw: { params: true, data: "process.env.NODE_ENV === 'development'" },
}
// → validateContract: { params: true, data: true }, throwContracts: { params: true, data: process.env.NODE_ENV === 'development' },

zodContracts: {
  validate: true,
  throw: (contractName, routeInfo) =>
    routeInfo.operationId === 'getBinaryReport' && contractName.endsWith('Contract'),
}
// → throwContracts: true,
```

Runtime logic:

- `validateContract: true` – both `params` and `data` are validated;
- `validateContract: false` or `undefined` – validation is not performed;
- `validateContract: { params?: boolean; data?: boolean }` – only the parts where the value is `true` are validated.
- `throwContracts` – when `true`, validation errors throw; when `false` or omitted, only warnings are logged. Object form controls `params`/`data` independently.



### `formatEndpointName`   

This option allows to format endpoint name.

Example:  
```ts
formatEndpointName: (endpointName, endpointData) => {
  return `${endpointName}Endpoint`;
}
// `getMyData` -> `getMyDataEndpoint`
```


### `groupBy`   

This option allows to group endpoints into object.    
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


### `formatExportGroupName`   

This option allows to format endpoints group export name.  

Example:  
```ts
formatExportGroupName: (groupName) => {
  return `${groupName}Api`;
}
```


### `outputType`   

This option allows to choose output type.   
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


### `requestMeta`   
This option allows to add some meta information for endpoint request.   
Can be helpful if you need to customize the base URL for http request.  

The `tmplData` field may be either a **string** or a **plain object** (`Record<string, unknown>`-style):

- **String** — inserted into generated code **as-is** (a TypeScript expression fragment). Use this when you need non-JSON syntax (unquoted keys, enums, variables, etc.).
- **Object** — at codegen time the value is turned into source via **`JSON.stringify`**, so the generated file contains a JSON-shaped object literal (e.g. double-quoted keys and string values).

You may pass either a **function** `(route, utils) => { tmplData }` (per-endpoint) or a **static object** `{ tmplData }` shared by all endpoints.

The legacy name `getRequestMeta` still works but is **deprecated**: codegen prints a warning and it will be removed in a future release.

Example (string — expression pasted into output):   
```ts{2}
requestMeta: () => ({
  tmplData: `{ service: 'auth' }`,
}),
```

Example (static object — same `tmplData` for every endpoint):   
```ts{2}
requestMeta: {
  tmplData: `{ service: 'auth' }`,
},
```

Example (object — serialized with `JSON.stringify` at codegen):   
```ts{2}
requestMeta: () => ({
  tmplData: { service: 'auth' },
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

### `endpointMeta`   
This option allows to add some meta information for endpoint.   

Fields:

- **`tmplData`** (required) — value for the endpoint’s `meta` field in generated code. Same rules as in [`requestMeta`](#requestmeta): **string** is emitted as-is; **plain object** is serialized with **`JSON.stringify`** at codegen time.
- **`typeName`** (optional) — TypeScript type for the **third generic** of `Endpoint<Response, Params, Meta>`. You only need this field: write any valid type text (inline object, union, `Pick<…>`, etc.). **`typeNameImportPath` is not required** to get a typed `Meta`. If `typeName` is omitted, codegen uses `any` for that generic.
- **`typeNameImportPath`** (optional) — use **only** when the meta type must be **imported** from another file. If you set it, codegen adds `import { <typeName> } from "<typeNameImportPath>"` to the endpoint file, so **`typeName` must then be the exported identifier** (e.g. `MyEndpointMeta`), not an inline `{ ... }` type. If you omit `typeNameImportPath`, **no import is emitted** — typical for inline types in the generic.

You may pass either a **function** `(route, utils) => { tmplData, ... }` or a **static object** with the same shape (shared by all endpoints).

The legacy name `getEndpointMeta` still works but is **deprecated**: codegen prints a warning and it will be removed in a future release.

Example:   
```ts{2}
endpointMeta: () => ({
  typeName: `{ somedata: string }`,
  tmplData: `{ somedata: '123' }`,
}),
```

Example (static object):   
```ts{2}
endpointMeta: {
  typeName: `{ somedata: string }`,
  tmplData: `{ somedata: '123' }`,
},
```

Example with `tmplData` as an object (codegen applies `JSON.stringify`):   
```ts{2}
endpointMeta: () => ({
  typeName: `{ somedata: string }`,
  tmplData: { somedata: '123' },
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

### `noMetaInfo`  

Allows to disable generation `meta-info.ts` file   

### `noBarrelFiles`

Disables generation of all `index.ts` barrel files in output.  
Default: `false`

Example:
```ts
noBarrelFiles: true
```

Example without groups, `one-endpoint-per-file`:
```
* outputdir
*  endpoints
*    get-endpoint-1.ts
*    get-endpoint-n.ts
*  data-contracts.ts
```
