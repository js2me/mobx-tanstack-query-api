import type { GenerateApiConfiguration } from 'swagger-typescript-api';

export type EnumStyle = GenerateApiConfiguration['config']['enumStyle'];

export interface StringEnumMember {
  key: string;
  value: string;
  /** Single-line JSDoc body (without block comment wrapper). */
  description?: string;
}

export const usesRuntimeEnumExports = (
  enumStyle: EnumStyle | undefined,
): boolean => enumStyle !== 'union';

export const renderConstObjectTypeDeclaration = (
  typeName: string,
  propertiesBody: string,
  options?: { export?: boolean },
): string => {
  const export_ = options?.export !== false ? 'export ' : '';

  return (
    `${export_}const ${typeName} = {\n${propertiesBody}\n} as const;\n` +
    `${export_}type ${typeName} = (typeof ${typeName})[keyof typeof ${typeName}];`
  );
};

const formatMemberBlock = (
  members: StringEnumMember[],
  renderMember: (member: StringEnumMember) => string,
): string =>
  members
    .map((member) => {
      const lines = [
        member.description && `/** ${member.description} */`,
        renderMember(member),
      ].filter(Boolean);

      return lines.join('\n');
    })
    .join(',\n');

export const renderStyledStringEnumDeclaration = (
  typeName: string,
  members: StringEnumMember[],
  enumStyle: EnumStyle | undefined,
): string => {
  if (enumStyle === 'const') {
    const propertiesBody = members
      .map(({ key, value }) => `  ${key}: ${JSON.stringify(value)}`)
      .join(',\n');

    return renderConstObjectTypeDeclaration(typeName, propertiesBody);
  }

  if (enumStyle === 'union') {
    return `export type ${typeName} = ${members
      .map(({ value }) => JSON.stringify(value))
      .join(' | ')};`;
  }

  const body = formatMemberBlock(
    members,
    ({ key, value }) => `${key} = ${JSON.stringify(value)}`,
  );

  return `export const enum ${typeName} {\n  ${body}\n}`;
};

export const formatStyledStringEnumMemberRef = (
  typeName: string,
  member: Pick<StringEnumMember, 'key' | 'value'>,
  enumStyle: EnumStyle | undefined,
): string => {
  if (enumStyle === 'union') {
    return JSON.stringify(member.value);
  }

  return `${typeName}.${member.key}`;
};
