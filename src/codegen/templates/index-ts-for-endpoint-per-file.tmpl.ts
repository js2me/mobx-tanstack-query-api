import type { BaseTmplParams } from '../types/index.js';
import { LINTERS_IGNORE } from './constants.js';

export interface IndexTsForEndpointPerFileTmplParams extends BaseTmplParams {
  generatedRequestFileNames: string[];
}

export const indexTsForEndpointPerFileTmpl = async ({
  generatedRequestFileNames,
}: IndexTsForEndpointPerFileTmplParams) => {
  return `${LINTERS_IGNORE}
${generatedRequestFileNames.map((fileName) => `export * from './${fileName.replace('.ts', '')}';`).join('\n')}
`;
};
