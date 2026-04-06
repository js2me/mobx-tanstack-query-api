import type { BaseTmplParams } from '../types/index.js';
import { generateExport } from '../utils/generate-export.js';
import { LINTERS_IGNORE } from './constants.js';

export interface IndexTsForEndpointPerFileTmplParams extends BaseTmplParams {
  generatedRequestFileNames: string[];
}

export const indexTsForEndpointPerFileTmpl = async ({
  generatedRequestFileNames,
  codegenParams,
}: IndexTsForEndpointPerFileTmplParams) => {
  return `${LINTERS_IGNORE}
${generatedRequestFileNames
  .map((fileName) =>
    generateExport(
      { asteriks: true },
      `./${fileName.replace('.ts', '')}`,
      codegenParams,
    ),
  )
  .join('\n')}
`;
};
