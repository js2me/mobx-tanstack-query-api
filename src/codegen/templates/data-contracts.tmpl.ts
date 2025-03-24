import {
  GenerateApiConfiguration,
  GenerateApiOutput,
} from 'swagger-typescript-api';

import type { CodegenProcess, QueryApiParams } from '../index.js';

import { dataContractTmpl } from './data-contract.tmpl.js';

export interface DataContractsTmplParams extends GenerateApiOutput {
  configuration: GenerateApiConfiguration;
  apiParams: QueryApiParams;
  codegenProcess: CodegenProcess;
  excludedDataContractNames?: string[];
}

export const dataContractsTmpl = async ({
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

  return await formatTSContent(`/* eslint-disable */
/* tslint:disable */

${contractDefinitions.join('\n\n')}
  `);
};
