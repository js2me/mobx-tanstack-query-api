import { camelCase, upperFirst } from 'es-toolkit';
import { describe, expect, it } from 'vitest';
import { formatGroupNameEnumKey } from './format-group-name-enum-key.js';
import { formatTagNameEnumKey } from './format-tag-name-enum-key.js';

const mockUtils = {
  _: {
    camelCase,
    upperFirst,
  },
} as any;

describe('format-tag-name-enum-key', () => {
  it('produces the same key for tags that differ only in casing/separators', () => {
    const key1 = formatTagNameEnumKey('cicd-repository', mockUtils);
    const key2 = formatTagNameEnumKey('Cicd Repository', mockUtils);
    expect(key1).toBe('CicdRepository');
    expect(key2).toBe('CicdRepository');
  });
});

describe('format-group-name-enum-key', () => {
  it('produces the same key for groups that differ only in casing/separators', () => {
    const key1 = formatGroupNameEnumKey('user-management', mockUtils);
    const key2 = formatGroupNameEnumKey('User Management', mockUtils);
    expect(key1).toBe('UserManagement');
    expect(key2).toBe('UserManagement');
  });
});
