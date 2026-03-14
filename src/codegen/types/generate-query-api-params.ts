import type {
  GenerateApiConfiguration,
  RawRouteInfo,
} from 'swagger-typescript-api';
import type { AnyObject, Maybe, MaybeFn } from 'yummies/types';
import type { RemoveUnusedTypesParams } from '../utils/remove-unused-types.js';
import type { FilterOption } from '../utils/unpack-filter-option.js';
import type { CodegenDataUtils } from './codegen-data-utils.js';
import type { EndpointData } from './endpoint-data.js';
import type { ImportFileParams } from './import-file-params.js';
import type { TypeInfo } from './type-info.js';

type RuntimeExpressionOrBoolean = string | boolean;

export interface GenerateQueryApiParams {
  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#output)
   */
  output: string;
  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#input)
   */
  input: string | AnyObject;
  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#mixininput)
   */
  mixinInput?: string | AnyObject;

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#requestpathprefix)
   */
  requestPathPrefix?: string;
  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#requestpathsuffix)
   */
  requestPathSuffix?: string;

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#removeunusedtypes)
   */
  removeUnusedTypes?:
    | true
    | Partial<Omit<RemoveUnusedTypesParams, 'directory'>>;

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#formatendpointname)
   */
  formatEndpointName?: (
    endpointName: string,
    endpointData: RawRouteInfo,
  ) => Maybe<string>;

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#formatexportgroupname)
   */
  formatExportGroupName?: (
    groupName: string,
    utils: CodegenDataUtils,
  ) => string;

  /**
   * Various generation output types
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#outputtype)
   *
   * `one-endpoint-per-file`
   * @example
   * ```
   * outputdir
   *  groupname
   *    index.ts
   *    endpoints
   *      index.ts
   *      get-endpoint-1.ts
   *      get-endpoint-n.ts
   * ```
   * @example
   * ```
   * outputdir
   *  index.ts
   *  endpoints
   *    index.ts
   *    get-endpoint-1.ts
   *    get-endpoint-n.ts
   * ```
   *
   * `endpoints-per-file`
   * @example
   * ```
   * outputdir
   *  groupname
   *    index.ts
   *    endpoints.ts
   * ```
   * @example
   * ```
   * outputdir
   *  index.ts
   *  endpoints.ts
   * ```
   */
  outputType?: 'one-endpoint-per-file' | 'endpoints-per-file';

  /**
   * Group endpoints and collect it into object
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#groupby)
   */
  groupBy?:
    | ((endpoint: EndpointData) => string)
    | `path-segment`
    | `path-segment-${number}`
    | `tag`
    | `tag-${number}`;

  /**
   * Collect all exports into single namespace
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#namespace)
   */
  namespace?: string | ((utils: AnyObject) => string);

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#addpathsegmenttoroutename)
   */
  addPathSegmentToRouteName?: boolean | number;

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#queryclient)
   */
  queryClient?: 'builtin' | ImportFileParams;
  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#endpoint)
   */
  endpoint?: 'builtin' | ImportFileParams;
  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#httpclient)
   */
  httpClient?: 'builtin' | ImportFileParams;

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#getendpointmeta)
   */
  getEndpointMeta?: (
    route: AnyObject,
    utils: AnyObject,
  ) => {
    typeName?: string;
    typeNameImportPath?: string;
    tmplData: string;
  };

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#getrequestmeta)
   */
  getRequestMeta?: (
    route: AnyObject,
    utils: AnyObject,
  ) => {
    tmplData: string;
  };

  /**
   * Additional parameters used to fetch your OpenAPI schema
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#fetchschemarequestoptions)
   */
  fetchSchemaRequestOptions?: RequestInit;

  otherCodegenParams?: Partial<GenerateApiConfiguration['config']>;

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#filterendpoints)
   */
  filterEndpoints?: FilterOption<(endpoint: EndpointData) => boolean>;

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#filtertypes)
   */
  filterTypes?: FilterOption<(type: TypeInfo) => boolean>;

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#filtergroups)
   */
  filterGroups?: FilterOption<(groupName: string) => boolean>;

  libImports?: {
    'mobx-tanstack-query-api'?: string;
  };

  tsconfigPath?: string;

  transforms?: {
    groupEnumValue?: (group: string, namespace?: Maybe<string>) => string;
    tagEnumValue?: (tag: string, namespace?: Maybe<string>) => string;
  };

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#cleanoutput)
   */
  cleanOutput?: boolean;

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#nometainfo)
   */
  noMetaInfo?: boolean;

  /**
   * Disable generation of index.ts barrel files.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config/#nobarrelfiles)
   */
  noBarrelFiles?: boolean;

  /**
   * Generate Zod contracts (params + data schemas) for each endpoint and add `contract` to the endpoint config.
   * When truthy, can also enable validation via `validateContract` in the endpoint config.
   * Requires `zod` to be installed.
   *
   * - `true`: generate contracts and set `validateContract: true` (validate params + data).
   * - `false`: no contracts, no validation.
   * - `{ validate: boolean }`: set `validateContract` to that boolean.
   * - `{ validate: string }`: set `validateContract` to the expression (inserted as-is). E.g. `"process.env.NODE_ENV === 'development'"`.
   * - `{ validate: { params?: boolean | string; data?: boolean | string } }`: set `validateContract` to an object; each value is literal or expression (string inserted as-is).
   *
   * When using an object form, optional `throw` controls `throwContracts` (throw on validation errors vs warn):
   * - `{ throw: boolean }`: set `throwContracts` to that boolean.
   * - `{ throw: string }`: set `throwContracts` to the expression (inserted as-is).
   * - `{ throw: { params?: boolean | string; data?: boolean | string } }`: set `throwContracts` to an object; each value is literal or expression (string inserted as-is).
   *
   * Optional `appendRule`: either a string (runtime) or a function (codegen-time).
   * - **string**: expression inserted as-is → `contract: <expr> ? <contractVar> : undefined`. E.g. `"process.env.NODE_ENV === \"development\""`.
   * - **function** (contractName, routeInfo) => boolean: at codegen time, if true → `contract: <contractVar>`, if false → `contract: undefined`.
   *
   * Optional `suffix`: suffix for generated shared Zod schema variables.
   * Shared schema names are based on data contract names in camelCase, e.g. `DispatchReceiptDC` -> `dispatchReceiptDc`.
   * Default: `""`.
   */
  zodContracts?:
    | boolean
    | {
        validate: MaybeFn<
          | RuntimeExpressionOrBoolean
          | {
              params?: RuntimeExpressionOrBoolean;
              data?: RuntimeExpressionOrBoolean;
            },
          [contractName: string, routeInfo: ZodContractsRouteInfo]
        >;
        throw?: MaybeFn<
          | RuntimeExpressionOrBoolean
          | {
              params?: RuntimeExpressionOrBoolean;
              data?: RuntimeExpressionOrBoolean;
            },
          [contractName: string, routeInfo: ZodContractsRouteInfo]
        >;
        /** String: runtime condition. Function: codegen-time filter for (contractName, routeInfo). */
        appendRule?: MaybeFn<
          RuntimeExpressionOrBoolean,
          [contractName: string, routeInfo: ZodContractsRouteInfo]
        >;
        /** Suffix for generated shared Zod schema variables. Default: "". */
        suffix?: string;
      };
}

/** Route info passed to zodContracts.appendRule at codegen time. */
export interface ZodContractsRouteInfo {
  operationId: string;
  path: string;
  method: string;
  contractName: string;
}
