# Getting started  

The `mobx-tanstack-query-api` source code is written on TypeScript and compiled into NodeNext target.   

## Requirements  

- [`MobX`](https://mobx.js.org) **^6**  

## Installation   

This package is using `mobx-tanstack-query`, `@tanstack/query-core` under the hood. So read documentation of [`mobx-tanstack-query`](https://github.com/js2me/mobx-tanstack-query) first.  

::: code-group

```bash [npm]
npm install {packageJson.name}
```

```bash [pnpm]
pnpm add {packageJson.name}
```

```bash [yarn]
yarn add {packageJson.name}
```

:::

## Usage   

Follow the steps:   

#### Create configuration file   

Create a codegen configuration file with file name `api-codegen.config.(js|mjs)` at root of your project.  
Add configuration using `defineConfig`  


```ts
import { defineConfig } from "mobx-tanstack-query-api/cli";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  // input: path.resolve(__dirname, './openapi.yaml'),
  input: "http://yourapi.com/url/openapi.yaml",
  output: path.resolve(__dirname, "src/shared/api/__generated__"),
  httpClient: "builtin",
  queryClient: "builtin",
  endpoint: "builtin",
  // namespace: 'collectedName',
  groupBy: "tag",
  // groupBy: 'tag-1',
  // groupBy: 'path-segment',
  // groupBy: 'path-segment-1',
  filterEndpoints: () => true,
  // groupBy:  route => {
  //   const api = apis.find(api => api.urls.some(url => route.raw.route.startsWith(url)))
  //   return api?.name ?? 'other'
  // },
  formatExportGroupName: (groupName) => `${groupName}Api`,
});
```

#### Add script to `package.json`

```json
...
"scripts": {
  ...
  "dev:api-codegen": "mobx-tanstack-query-api"
  ...
}
...
```   

#### Run codegen   


::: code-group

```bash [npm]
npm run dev:api-codegen
```

```bash [pnpm]
pnpm dev:api-codegen
```

```bash [yarn]
yarn dev:api-codegen
```

:::

or just call   

```bash  
npx mobx-tanstack-query-api
```

#### Use queries and mutations

```ts
import { getFruits, createFruit, Tag } from "@/shared/api/__generated__";

export const fruitsQuery = getFruits.toQuery({
  enableOnDemand: true,
  params: {},
});

export const fruitCreateMutation = createFruit.toMutation({
  invalidateEndpoints: {
    tag: [Tag.Fruits],
  },
});
```

Another example with classes

```ts
import { getFruits } from "@/shared/api/__generated__";

export class Fruits {
  private abortController = new AbortController();

  @observable
  private accessor params = {
    search: "",
  };

  private fruitsQuery = getFruits.toQuery({
    abortSignal: this.abortController.signal,
    enableOnDemand: true,
    params: () => ({
      query: {
        search: this.params.search,
      },
    }),
  });

  constructor(abortSignal?: AbortSignal) {
    // or you can use linked-abort-controller package
    abortSignal.addEventListener("abort", () => {
      this.abortController.abort();
    });
  }

  @computed.struct
  get data() {
    return this.fruitsQuery.data || [];
  }

  @computed.struct
  get isLoading() {
    return this.fruitsQuery.isLoading;
  }

  destroy() {
    this.abortController.abort();
  }
}

const fruits = new FruitsModel();

console.log(fruits.data); // enable query
```

You can read about all details in further sections.   