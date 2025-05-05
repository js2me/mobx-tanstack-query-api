import { AnyObject } from 'yummies/utils/types';

import type { CodegenProcess, GenerateQueryApiParams } from '../index.js';

import { LINTERS_IGNORE } from './constants.js';
import { dataContractTmpl } from './data-contract.tmpl.js';

export interface DataContractsTmplParams extends AnyObject {
  configuration: AnyObject;
  apiParams: GenerateQueryApiParams;
  codegenProcess: CodegenProcess;
  excludedDataContractNames?: string[];
}

export const dataContractsFileTmpl = async ({
  configuration,
  formatTSContent,
  excludedDataContractNames,
}: DataContractsTmplParams) => {
  const { config, modelTypes } = configuration;

  const contractDefinitions: string[] = [];

  if (config.internalTemplateOptions?.addUtilRequiredKeysType) {
    contractDefinitions.push(
      `type UtilRequiredKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>`,
    );
  }

  for await (const contract of modelTypes) {
    if (excludedDataContractNames?.includes(contract.name)) {
      continue;
    }

    contractDefinitions.push(
      await dataContractTmpl({
        configuration,
        contract,
        addExportKeyword: true,
      }),
    );
  }

  return await formatTSContent(`${LINTERS_IGNORE}

${contractDefinitions.join('\n\n')}
  `);
};
