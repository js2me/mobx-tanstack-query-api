import type { Maybe } from 'yummies/types';

import type {
  BaseTmplParams,
  CodegenDataUtils,
  MetaInfo,
} from '../types/index.js';

import { LINTERS_IGNORE } from './constants.js';

export interface AllExportsTmplParams extends BaseTmplParams {
  collectedExportFiles: string[];
  metaInfo: Maybe<MetaInfo>;
  /** When true, add export * from './schemas' (Zod schemas from zodContracts) */
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
}: AllExportsTmplParams) => {
  return await formatTSContent(`${LINTERS_IGNORE}
  export * from './data-contracts';
  ${exportSchemas ? "  export * from './schemas';\n  " : ''}${collectedExportFiles.map((fileName) => `export * from './${fileName}';`).join('\n')}
  ${metaInfo ? 'export * from "./meta-info";' : ''}
    `);
};
