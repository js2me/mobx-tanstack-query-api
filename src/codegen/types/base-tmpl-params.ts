import type {
  GenerateApiConfiguration,
  GenerateApiParams,
} from 'swagger-typescript-api';
import type { AnyObject, Defined } from 'yummies/types';
import type { UnpackedFilterOption } from '../utils/unpack-filter-option.js';
import type { AllImportFileParams } from './all-import-file-params.js';
import type { CodegenDataUtils } from './codegen-data-utils.js';
import type { GenerateQueryApiParams } from './generate-query-api-params.js';

type DefinedCodegenParams = Omit<GenerateQueryApiParams, 'libImports'> & {
  libImports: Required<
    Exclude<GenerateQueryApiParams['libImports'], undefined>
  >;
};

export interface BaseTmplParams {
  formatTSContent: (content: string) => Promise<string>;
  configuration: GenerateApiConfiguration;
  codegenParams: DefinedCodegenParams;
  codegenProcess: Parameters<
    Defined<Defined<GenerateApiParams['hooks']>['onInit']>
  >['1'];
  importFileParams: AllImportFileParams;
  utils: CodegenDataUtils;
  swaggerSchema: AnyObject;
  filterTypes: UnpackedFilterOption<
    Defined<GenerateQueryApiParams['filterTypes']>
  >;
}
