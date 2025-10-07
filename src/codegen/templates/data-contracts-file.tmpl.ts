import type { BaseTmplParams } from '../types/index.js';
import { LINTERS_IGNORE } from './constants.js';
import { dataContractTmpl } from './data-contract.tmpl.js';

export interface DataContractsTmplParams extends BaseTmplParams {
  excludedDataContractNames?: string[];
}

export const dataContractsFileTmpl = async (
  params: DataContractsTmplParams,
) => {
  const { config, modelTypes } = params.configuration;

  const contractDefinitions: string[] = [];

  if (config.internalTemplateOptions?.addUtilRequiredKeysType) {
    contractDefinitions.push(
      `type UtilRequiredKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>`,
    );
  }

  for await (const contract of modelTypes) {
    if (params.excludedDataContractNames?.includes(contract.name)) {
      continue;
    }

    contractDefinitions.push(
      await dataContractTmpl({
        ...params,
        contract,
        addExportKeyword: true,
      }),
    );
  }

  return await params.formatTSContent(`${LINTERS_IGNORE}

${contractDefinitions.length > 0 ? contractDefinitions.join('\n\n') : `export {}`}
  `);
};
