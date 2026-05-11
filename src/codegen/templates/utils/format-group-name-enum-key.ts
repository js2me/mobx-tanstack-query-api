import type { CodegenDataUtils } from '../../types/index.js';

/**
 * Enum member names must be valid TS identifiers; bare numeric literals (e.g. `1`)
 * and leading digits after camelCase (e.g. `123Abc`) are invalid.
 */
export const ensureValidTsEnumMemberKey = (
  formatted: string,
  rawHint: string,
  { _ }: CodegenDataUtils,
): string => {
  let key = formatted.trim();
  if (!key) {
    const sanitized = rawHint
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    key = _.upperFirst(_.camelCase(sanitized || 'group'));
    if (!key) key = 'Group';
  }
  if (/^\d/.test(key)) key = `_${key}`;
  return key;
};

export const formatGroupNameEnumKey = (
  groupName: string,
  utils: CodegenDataUtils,
) =>
  ensureValidTsEnumMemberKey(
    utils._.upperFirst(utils._.camelCase(groupName)),
    groupName,
    utils,
  );
