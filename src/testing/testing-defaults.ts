/**
 * Shared defaults for **`mobx-tanstack-query-api/testing`** (`MockHttpResponse`, MSW helpers, etc.).
 * You may assign to **`successStatus`** / **`errorStatus`** (e.g. in a global test setup) to change
 * defaults for all helpers that read this object.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/testing/testing-defaults.html)
 */
export const testingDefaults = {
  successStatus: 200,
  errorStatus: 500,
};
