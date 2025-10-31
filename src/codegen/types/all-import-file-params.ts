import type { KeyOfByValue } from 'yummies/types';
import type { GenerateQueryApiParams } from './generate-query-api-params.js';
import type { ImportFileParams } from './import-file-params.js';

export type AllImportFileParams = Record<
  KeyOfByValue<Required<GenerateQueryApiParams>, 'builtin' | ImportFileParams>,
  ImportFileParams
>;
