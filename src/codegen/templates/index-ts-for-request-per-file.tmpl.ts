import {
  GenerateApiConfiguration,
  GenerateApiOutput,
} from 'swagger-typescript-api';

import { CodegenProcess, QueryApiParams } from '../index.js';

export interface IndexTsForRequestPerFileTmplParams extends GenerateApiOutput {
  configuration: GenerateApiConfiguration;
  apiParams: QueryApiParams;
  codegenProcess: CodegenProcess;
  generatedRequestFileNames: string[];
}

export const indexTsForRequestPerFileTmpl = async ({
  generatedRequestFileNames,
}: IndexTsForRequestPerFileTmplParams) => {
  return `
export * from './data-contracts';
${generatedRequestFileNames.map((fileName) => `export * from './${fileName.replace('.ts', '')}';`).join('\n')}
`;
};
