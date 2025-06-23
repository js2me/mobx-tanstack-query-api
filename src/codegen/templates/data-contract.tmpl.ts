import { AnyObject } from 'yummies/utils/types';

export interface DataContractTmplParams {
  configuration: AnyObject;
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

export const dataContractTmpl = async ({
  contract,
  configuration,
  addExportKeyword,
}: DataContractTmplParams) => {
  const { utils } = configuration;
  const { formatDescription } = utils;

  const dataContractTemplates: Record<string, (contract: any) => string> = {
    enum: (contract: any) => {
      return `enum ${contract.name} {\r\n${contract.content}\r\n}`;
    },
    interface: (contract: any) => {
      return `interface ${contract.name}${buildGenerics(contract)} {\r\n${contract.content}}`;
    },
    type: (contract: any) => {
      return `type ${contract.name}${buildGenerics(contract)} = ${contract.content === contract.name ? 'any' : contract.content}`;
    },
  };

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

  const contractType = `${addExportKeyword ? 'export ' : ''}${templateFn(contract)}`;

  return result + contractType;
};
