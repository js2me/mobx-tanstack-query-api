
# CLI  

To generate code based on your configuration file use command:   

```bash
npx mobx-tanstack-query-api
```

Or via `package.json` scripts:

```json
{
  "scripts": {
    "codegen": "mobx-tanstack-query-api"
  }
}
```

```bash
npm run codegen
```

## Options   

#### `-c, --config <path>`   

Path to configuration file   

If not set will try to find `api-codegen.config.{ts|js|mjs|json}` in current directory.