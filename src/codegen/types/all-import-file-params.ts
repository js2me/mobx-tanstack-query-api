import type { KeyOfByValue } from 'yummies/types';
import type { GenerateQueryApiParams } from './generate-query-api-params.js';
import type { ImportFileParams } from './import-file-params.js';

type BuiltinOrCustomLib = 'builtin' | 'skip' | ImportFileParams;

export type AllImportFileParams = Record<
  KeyOfByValue<Required<GenerateQueryApiParams>, BuiltinOrCustomLib>,
  ImportFileParams
> & {
  /**
   * When set, omit the HTTP client import and pass `undefined as any` as the `Endpoint` constructor’s client argument.
   */
  skipHttpClient?: boolean;
  /**
   * When set, omit the query client import and pass `undefined as any` as the `Endpoint` constructor’s query-client argument.
   */
  skipQueryClient?: boolean;
};
