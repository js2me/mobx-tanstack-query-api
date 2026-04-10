import type {
  GenerateApiConfiguration,
  ParsedRoute,
  RawRouteInfo,
} from 'swagger-typescript-api';
import type { AnyObject, Maybe, MaybeFalsy, MaybeFn } from 'yummies/types';
import type { FullRequestParams } from '../../runtime/http-client.js';
import type { RemoveUnusedTypesParams } from '../utils/remove-unused-types.js';
import type { FilterOption } from '../utils/unpack-filter-option.js';
import type { CodegenDataUtils } from './codegen-data-utils.js';
import type { EndpointData } from './endpoint-data.js';
import type { ImportFileParams } from './import-file-params.js';
import type { TypeInfo } from './type-info.js';

type RuntimeExpressionOrBoolean = string | boolean;

/**
 * Same string values as TypeScript [`compilerOptions.moduleResolution`](https://www.typescriptlang.org/tsconfig/#moduleResolution)
 * that you want codegen to mirror.
 *
 * **Emit:** only `node16` and `nodenext` add a `.js` suffix to relative specifiers in generated
 * files (NodeNext-style). `bundler`, `classic`, `node` / `node10`, or omitting the option omit the
 * suffix (bundler / legacy Node resolution). `node` is the legacy tsconfig spelling for Node10-style.
 */
export type CodegenModuleResolution =
  | 'bundler'
  | 'classic'
  | 'node'
  | 'node10'
  | 'node16'
  | 'nodenext';

/**
 * Identity of an endpoint at codegen time (operation, path, generated contract variable base name).
 * Used by `zodContracts` callbacks and by `requestPathPrefix` / `requestPathSuffix` when they are functions.
 */
export interface RouteBaseInfo {
  operationId: string;
  path: string;
  method: string;
  contractName: string;
}

/** Static `endpointMeta` value or return type of its callback. */
export interface CodegenEndpointMetaData {
  /**
   * TypeScript type for `Endpoint<…, …, Meta>` (third generic). Omitted → `any`.
   * Does not require {@link CodegenEndpointMetaData.typeNameImportPath}; use that only when the type must be imported from a module.
   * If `typeNameImportPath` is set, `typeName` must be a single exported name (import specifier), not an inline `{ … }` type.
   */
  typeName?: string;
  /**
   * Optional. If set (with `typeName`), codegen emits `import { typeName } from typeNameImportPath` in the endpoint file.
   * Omit when the generic type is written inline and needs no import.
   */
  typeNameImportPath?: string;
  /** Plain object is serialized with `JSON.stringify` in generated code; string is inserted as-is. */
  tmplData: string | AnyObject;
}

export type EndpointMetaOption =
  | CodegenEndpointMetaData
  | ((route: ParsedRoute, utils: CodegenDataUtils) => CodegenEndpointMetaData);

/** Static `requestMeta` value or return type of its callback. */
export interface CodegenRequestMetaData {
  /** Plain object is serialized with `JSON.stringify` in generated code; string is inserted as-is. */
  tmplData: string | AnyObject;
}

export type RequestMetaOption =
  | CodegenRequestMetaData
  | ((route: ParsedRoute, utils: CodegenDataUtils) => CodegenRequestMetaData);

export interface GenerateQueryApiParams {
  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#output)
   */
  output: string;
  /**
   * Falsy values (`undefined`, `null`, `''`, `false`, `0`) — вся конфигурация игнорируется в `generateApi` (и при запуске через CLI после `defineConfig`).
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#input)
   */
  input: MaybeFalsy<string | AnyObject>;
  /**
   * Suffix for generated data-contract type names.
   * Default: `"DC"`.
   * Set to `false` to disable suffix.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#datacontracttypesuffix)
   */
  dataContractTypeSuffix?: string | false;
  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#mixininput)
   */
  mixinInput?: string | AnyObject;

  /**
   * Mirror your `tsconfig` `moduleResolution` (`bundler`, `node16`, `nodenext`, `node10`, `classic`, …).
   * Only `node16` / `nodenext` make codegen append `.js` to relative specifiers.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#moduleresolution)
   */
  moduleResolution?: CodegenModuleResolution;

  /**
   * String: inserted as-is before the route path. Function: receives endpoint info and returns the prefix string.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#requestpathprefix)
   */
  requestPathPrefix?: string | ((endpoint: RouteBaseInfo) => string);
  /**
   * String: inserted as-is after the route path. Function: receives endpoint info and returns the suffix string.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#requestpathsuffix)
   */
  requestPathSuffix?: string | ((endpoint: RouteBaseInfo) => string);

  /**
   * Static partial {@link FullRequestParams}, a **non-empty** string (inserted as a TS expression inside
   * `...(<expr>),`, same idea as `endpointMeta.tmplData` string), or a function evaluated at **codegen**
   * time per endpoint with {@link RouteBaseInfo}. The result is spread into each generated
   * `configuration.params` return **before** `...requestParams`, so callers can still override those keys
   * at runtime. Falsy values are ignored (nothing is emitted).
   */
  overrideRequestParams?: MaybeFn<
    MaybeFalsy<Partial<FullRequestParams> | string>,
    [routeInfo: RouteBaseInfo]
  >;

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#removeunusedtypes)
   */
  removeUnusedTypes?:
    | true
    | Partial<Omit<RemoveUnusedTypesParams, 'directory'>>;

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#formatendpointname)
   */
  formatEndpointName?: (
    endpointName: string,
    endpointData: RawRouteInfo,
  ) => Maybe<string>;

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#formatexportgroupname)
   */
  formatExportGroupName?: (
    groupName: string,
    utils: CodegenDataUtils,
  ) => string;

  /**
   * Various generation output types
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#outputtype)
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
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#groupby)
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
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#namespace)
   */
  namespace?: string | ((utils: AnyObject) => string);

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#addpathsegmenttoroutename)
   */
  addPathSegmentToRouteName?: boolean | number;

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#queryclient)
   */
  queryClient?: 'builtin' | ImportFileParams;
  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#endpoint)
   */
  endpoint?: 'builtin' | ImportFileParams;
  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#httpclient)
   */
  httpClient?: 'builtin' | ImportFileParams;

  /**
   * Object with `tmplData`, or a function `(route, utils) => { tmplData, ... }` per endpoint.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#endpointmeta)
   */
  endpointMeta?: EndpointMetaOption;

  /**
   * @deprecated Use {@link GenerateQueryApiParams.endpointMeta} instead. This option will be removed in a future release.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#endpointmeta)
   */
  getEndpointMeta?: EndpointMetaOption;

  /**
   * Object with `tmplData`, or a function `(route, utils) => { tmplData }` per endpoint.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#requestmeta)
   */
  requestMeta?: RequestMetaOption;

  /**
   * @deprecated Use {@link GenerateQueryApiParams.requestMeta} instead. This option will be removed in a future release.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#requestmeta)
   */
  getRequestMeta?: RequestMetaOption;

  /**
   * Additional parameters used to fetch your OpenAPI schema
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#fetchschemarequestoptions)
   */
  fetchSchemaRequestOptions?: RequestInit;

  otherCodegenParams?: Partial<GenerateApiConfiguration['config']>;

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#filterendpoints)
   */
  filterEndpoints?: FilterOption<(endpoint: EndpointData) => boolean>;

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#filtertypes)
   */
  filterTypes?: FilterOption<(type: TypeInfo) => boolean>;

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#filtergroups)
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
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#cleanoutput)
   */
  cleanOutput?: boolean;

  /**
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#nometainfo)
   */
  noMetaInfo?: boolean;

  /**
   * Disable generation of index.ts barrel files.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#nobarrelfiles)
   */
  noBarrelFiles?: boolean;

  /**
   * Generate Zod contracts for each endpoint (`contract`, optional `validateContract` / `throwContracts`). Requires `zod`. Option shapes are documented at the link above.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/codegen/config#zodcontracts)
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
          [contractName: string, routeInfo: RouteBaseInfo]
        >;
        throw?: MaybeFn<
          | RuntimeExpressionOrBoolean
          | {
              params?: RuntimeExpressionOrBoolean;
              data?: RuntimeExpressionOrBoolean;
            },
          [contractName: string, routeInfo: RouteBaseInfo]
        >;
        /** String: runtime condition. Function: codegen-time filter for (contractName, routeInfo). */
        appendRule?: MaybeFn<
          RuntimeExpressionOrBoolean,
          [contractName: string, routeInfo: RouteBaseInfo]
        >;
        /** Suffix for generated shared Zod schema variables. Default: "". */
        suffix?: string;
      };
}

/** Config with a truthy {@link GenerateQueryApiParams.input} (actually runs codegen). */
export type GenerateQueryApiParamsWithInput = GenerateQueryApiParams & {
  input: string | AnyObject;
};
