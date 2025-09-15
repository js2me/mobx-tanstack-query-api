# Configuration file   

This project is requires a configuration file.   
You need to create a configuration file named as `api-codegen.config.{js|mjs|json|ts}`. Recommends to create `api-codegen.config.ts` or you can create a configuration file with your own name, but you need to use `-c`, `--config` option in cli.   

::: tip use `defineConfig` function
This function is exports from `mobx-tanstack-query-api/cli` import. It adds typings for your configuration file.  
:::

```ts
import { defineConfig } from "mobx-tanstack-query-api/cli";


export default defineConfig({
  input: 'path-or-url-to-openapi.{yaml|json}',
  output: 'path-to-output-directory',
})
```