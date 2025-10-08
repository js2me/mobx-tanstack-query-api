import type {
  GenerateApiConfiguration,
  GenerateApiParams,
} from 'swagger-typescript-api';
import type { Defined } from 'yummies/utils/types';
import type { UnpackedFilterOption } from '../utils/unpack-filter-option.js';
import type { AllImportFileParams } from './all-import-file-params.js';
import type { CodegenDataUtils } from './codegen-data-utils.js';
import type { GenerateQueryApiParams } from './generate-query-api-params.js';

export interface BaseTmplParams {
  formatTSContent: (content: string) => Promise<string>;
  configuration: GenerateApiConfiguration;
  codegenParams: GenerateQueryApiParams;
  codegenProcess: Parameters<
    Defined<Defined<GenerateApiParams['hooks']>['onInit']>
  >['1'];
  importFileParams: AllImportFileParams;
  utils: CodegenDataUtils;
  filterTypes: UnpackedFilterOption<
    Defined<GenerateQueryApiParams['filterTypes']>
  >;
}
