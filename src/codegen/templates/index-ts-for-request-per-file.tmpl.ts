import { AnyObject } from 'yummies/utils/types';

import { CodegenProcess, GenerateQueryApiParams } from '../index.js';

import { LINTERS_IGNORE } from './constants.js';

export interface IndexTsForRequestPerFileTmplParams extends AnyObject {
  configuration: AnyObject;
  apiParams: GenerateQueryApiParams;
  codegenProcess: CodegenProcess;
  generatedRequestFileNames: string[];
}

export const indexTsForRequestPerFileTmpl = async ({
  generatedRequestFileNames,
}: IndexTsForRequestPerFileTmplParams) => {
  return `${LINTERS_IGNORE}
${generatedRequestFileNames.map((fileName) => `export * from './${fileName.replace('.ts', '')}';`).join('\n')}
`;
};
