import { describe, expect, it } from 'vitest';
import * as _ from 'es-toolkit';
import type { CodegenDataUtils } from '../../src/codegen/types/codegen-data-utils.js';
import {
  ensureValidTsEnumMemberKey,
  formatGroupNameEnumKey,
} from '../../src/codegen/templates/utils/format-group-name-enum-key.js';

const utils: CodegenDataUtils = {
  Ts: null,
  _: _,
  getInlineParseContent: () => '',
  formatModelName: (modelName) => modelName,
};

describe('formatGroupNameEnumKey', () => {
  it('adds leading underscore when the key starts with a digit', () => {
    expect(formatGroupNameEnumKey('1', utils)).toBe('_1');
    expect(formatGroupNameEnumKey('10', utils)).toBe('_10');
    expect(formatGroupNameEnumKey('8', utils)).toBe('_8');
  });

  it('prefixes keys that are numeric after camelCase', () => {
    expect(formatGroupNameEnumKey('1-2', utils)).toBe('_12');
    expect(formatGroupNameEnumKey('123abc', utils)).toBe('_123Abc');
  });

  it('leaves ordinary segment names as PascalCase identifiers', () => {
    expect(formatGroupNameEnumKey('other', utils)).toBe('Other');
    expect(formatGroupNameEnumKey('api-v2', utils)).toBe('ApiV2');
  });

  it('ensureValidTsEnumMemberKey recovers from empty formatted output using rawHint', () => {
    expect(ensureValidTsEnumMemberKey('', '###', utils)).toBe('Group');
  });
});
