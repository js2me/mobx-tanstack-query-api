import type { AnyObject } from 'yummies/types';
import type { BaseTmplParams } from '../types/index.js';
import { renderConstObjectTypeDeclaration } from './utils/render-styled-string-enum.js';

export interface DataContractTmplParams extends BaseTmplParams {
  contract: AnyObject;
  addExportKeyword?: boolean;
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

const dataContractTemplates: Record<
  string,
  (params: DataContractTmplParams) => string
> = {
  const: ({ contract, addExportKeyword }) => {
    const propertiesBody = (contract.$content ?? contract.rawContent ?? [])
      .map(
        ({ key, value }: { key: string; value: string }) =>
          `  ${key}: ${value}`,
      )
      .join(',\n');

    return renderConstObjectTypeDeclaration(contract.name, propertiesBody, {
      export: !!addExportKeyword,
    });
  },
  enum: ({ contract, addExportKeyword }) => {
    const export_ = addExportKeyword ? 'export ' : '';
    return `${export_}enum ${contract.name} {\r\n${contract.content}\r\n}`;
  },
  'const enum': ({ contract, addExportKeyword }) => {
    const export_ = addExportKeyword ? 'export ' : '';
    return `${export_}const enum ${contract.name} {\r\n${contract.content}\r\n}`;
  },
  interface: ({ contract, addExportKeyword }) => {
    const export_ = addExportKeyword ? 'export ' : '';
    return `${export_}interface ${contract.name}${buildGenerics(contract)} {\r\n${contract.content}}`;
  },
  type: ({ contract, addExportKeyword }) => {
    const export_ = addExportKeyword ? 'export ' : '';
    return `${export_}type ${contract.name}${buildGenerics(contract)} = ${contract.content === contract.name ? 'any' : contract.content}`;
  },
};

export const dataContractTmpl = async (params: DataContractTmplParams) => {
  const { contract, configuration } = params;
  const { utils } = configuration;
  const { formatDescription } = utils;

  let result: string = '';

  let jsdoc = '';

  if (contract.description) {
    jsdoc = `/**\n * ${formatDescription(contract.description, true)}\n */\n`;
  }

  if (jsdoc) {
    result += jsdoc;
  }

  const templateFn =
    dataContractTemplates[contract.typeIdentifier] ||
    dataContractTemplates.type;

  const contractType = templateFn(params);

  return result + contractType;
};
