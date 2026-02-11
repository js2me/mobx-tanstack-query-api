# HttpClient   

This is http requests client wrapper based on [`Fetch API`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).   


## Usage  

```ts
import { HttpClient } from "mobx-tanstack-query-api";

const httpClient = new HttpClient();

const response = await httpClient.request({
  path: "/api/v1/fruits",
  method: "GET",
});

console.log(response.status, response.data);
``` 

## API

### constructor

Creates `HttpClient` instance.

```ts
const httpClient = new HttpClient({
  baseUrl: "https://api.example.com",
});
```

### baseUrl

Resolved base URL for requests.

```ts
const httpClient = new HttpClient({ baseUrl: "https://api.example.com" });

console.log(httpClient.baseUrl); // https://api.example.com
```

### meta

Mutable metadata storage that can be used in `interceptor` and `buildUrl`.

```ts
const httpClient = new HttpClient<{ token?: string }>({
  meta: { token: "abc" },
});

console.log(httpClient.meta?.token); // abc
```

### badResponse

Contains the latest failed HTTP response or parse error.

```ts
try {
  await httpClient.request({
    path: "/api/v1/forbidden",
    method: "GET",
  });
} catch {
  console.log(httpClient.badResponse); // failed response
}
```

### updateConfig

Updates client config at runtime.

```ts
httpClient.updateConfig({
  baseUrl: "https://staging-api.example.com",
  baseApiParams: {
    headers: {
      "X-App-Version": "1.0.0",
    },
  },
});
```

### setMeta

Updates current `meta` object.

```ts
httpClient.setMeta({ token: "new-token" });
```

### setBadResponse

Manually sets `badResponse` value.

```ts
httpClient.setBadResponse({ custom: "error" });
```

### buildUrl

Builds final request URL from `baseUrl`, `path` and `query`.

```ts
const url = httpClient.buildUrl({
  path: "/api/v1/fruits",
  query: { page: 1, limit: 10 },
});

console.log(url); // /api/v1/fruits?page=1&limit=10
```

### request

Sends HTTP request and returns `HttpResponse`. Throws on non-OK responses.

```ts
const result = await httpClient.request<{ items: string[] }, { message: string }>({
  path: "/api/v1/fruits",
  method: "GET",
  format: "json",
});

console.log(result.data.items);
```

## More examples

### GET with query params

```ts
const response = await httpClient.request({
  path: "/api/v1/fruits",
  method: "GET",
  query: {
    page: 1,
    search: "apple",
  },
  format: "json",
});
```

### POST JSON body

```ts
import { ContentType } from "mobx-tanstack-query-api";

const response = await httpClient.request({
  path: "/api/v1/fruits",
  method: "POST",
  contentType: ContentType.Json,
  body: {
    title: "Apple",
    color: "green",
  },
  format: "json",
});
```

### Upload file with FormData content type

```ts
import { ContentType } from "mobx-tanstack-query-api";

await httpClient.request({
  path: "/api/v1/files",
  method: "POST",
  contentType: ContentType.FormData,
  body: {
    file: selectedFile,
    folder: "avatars",
  },
});
```

### Add auth token via interceptor

```ts
const httpClient = new HttpClient<{ token?: string }>({
  meta: { token: "secret-token" },
  interceptor: (params, meta) => ({
    ...params,
    headers: {
      ...params.headers,
      Authorization: meta?.token ? `Bearer ${meta.token}` : "",
    },
  }),
});
```

### Handle request errors

```ts
try {
  await httpClient.request({
    path: "/api/v1/fruits/unknown-id",
    method: "GET",
    format: "json",
  });
} catch (error) {
  console.log("Request failed", error);
  console.log("Last bad response", httpClient.badResponse);
}
```

### Custom URL builder

```ts
const httpClient = new HttpClient({
  baseUrl: "https://api.example.com",
  buildUrl: (_fullParams, parts) => `${parts.baseUrl}${parts.path}${parts.query}`,
});
```