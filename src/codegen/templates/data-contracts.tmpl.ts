import {
  GenerateApiConfiguration,
  GenerateApiOutput,
} from 'swagger-typescript-api';

import type { CodegenProcess, QueryApiParams } from '../index.js';

export interface DataContractsTmplParams extends GenerateApiOutput {
  configuration: GenerateApiConfiguration;
  apiParams: QueryApiParams;
  codegenProcess: CodegenProcess;
  excludedDataContractNames?: string[];
}

const buildGenerics = (contract: any) => {
  if (!contract.genericArgs?.length) return '';

  return (
    '<' +
    contract.genericArgs
      .map((arg: any) => {
        const { name, default: defaultType, extends: extendsType } = arg;
        return [
          name,
          extendsType && `extends ${extendsType}`,
          defaultType && `= ${defaultType}`,
        ]
          .filter(Boolean)
          .join(' ');
      })
      .join(', ') +
    '>'
  );
};

export const dataContractsTmpl = async ({
  configuration,
  formatTSContent,
}: DataContractsTmplParams) => {
  const { utils, config, modelTypes } = configuration;
  const { formatDescription } = utils;

  const dataContractTemplates: Record<string, (contract: any) => string> = {
    enum: (contract: any) => {
      return `enum ${contract.name} {\r\n${contract.content}\r\n}`;
    },
    interface: (contract: any) => {
      return `interface ${contract.name}${buildGenerics(contract)} {\r\n${contract.content}}`;
    },
    type: (contract: any) => {
      return `type ${contract.name}${buildGenerics(contract)} = ${contract.content}`;
    },
  };

  const contractDefinitions: string[] = [];

  if (config.internalTemplateOptions?.addUtilRequiredKeysType) {
    contractDefinitions.push(
      `type UtilRequiredKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>`,
    );
  }

  for (const contract of modelTypes) {
    // if(excludedDataContractNames && excludedDataContractNames.includes(contract.name)) {
    //   continue;
    // }

    let jsdoc = '';
    if (contract.description) {
      jsdoc = `/**\n * ${formatDescription(contract.description, true)}\n */`;
    }

    if (jsdoc) {
      contractDefinitions.push(jsdoc);
    }

    const templateFn =
      dataContractTemplates[contract.typeIdentifier] ||
      dataContractTemplates.type;
    const isInternal = 'internal' in contract ? contract.internal : false;
    const contractCode = `${isInternal ? '' : 'export'} ${templateFn(contract)}`;
    contractDefinitions.push(contractCode);
  }

  return await formatTSContent(`
/* eslint-disable */
/* tslint:disable */

${contractDefinitions.join('\n\n')}
  `);
};
