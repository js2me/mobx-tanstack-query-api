import type { Maybe } from 'yummies/types';
import type {
  BaseTmplParams,
  CodegenDataUtils,
  MetaInfo,
} from '../types/index.js';
import { generateExport } from '../utils/generate-export.js';

import { LINTERS_IGNORE } from './constants.js';

export interface AllExportsTmplParams extends BaseTmplParams {
  collectedExportFiles: string[];
  metaInfo: Maybe<MetaInfo>;
  /** When true, add export * from './contracts' (shared Zod contracts from zodContracts) */
  exportSchemas?: boolean;
}

export const formatGroupNameEnumKey = (
  groupName: string,
  { _ }: CodegenDataUtils,
) => _.upperFirst(_.camelCase(groupName));

export const allExportsTmpl = async ({
  collectedExportFiles,
  metaInfo,
  formatTSContent,
  exportSchemas,
  codegenParams,
}: AllExportsTmplParams) => {
  const lines: string[] = [
    generateExport({ asteriks: true }, './data-contracts', codegenParams),
  ];
  if (exportSchemas) {
    lines.push(
      generateExport({ asteriks: true }, './contracts', codegenParams),
    );
  }
  for (const fileName of collectedExportFiles) {
    lines.push(
      generateExport({ asteriks: true }, `./${fileName}`, codegenParams),
    );
  }
  if (metaInfo) {
    lines.push(
      generateExport({ asteriks: true }, './meta-info', codegenParams),
    );
  }
  return await formatTSContent(`${LINTERS_IGNORE}
${lines.join('\n')}
    `);
};
