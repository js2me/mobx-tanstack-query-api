import { describe, expect, it } from 'vitest';
import {
  formatStyledStringEnumMemberRef,
  renderConstObjectTypeDeclaration,
  renderStyledStringEnumDeclaration,
  usesRuntimeEnumExports,
} from '../../src/codegen/templates/utils/render-styled-string-enum.js';

describe('renderStyledStringEnumDeclaration', () => {
  const members = [
    { key: 'Pets', value: 'pets', description: 'Pets tag' },
    { key: 'Admin', value: 'admin' },
  ];

  it('renders const enum by default', () => {
    expect(renderStyledStringEnumDeclaration('Tag', members, undefined)).toBe(
      `export const enum Tag {
  /** Pets tag */
Pets = "pets",
Admin = "admin"
}`,
    );
  });

  it('renders const object + type alias', () => {
    expect(renderStyledStringEnumDeclaration('Tag', members, 'const')).toBe(
      `export const Tag = {
  Pets: "pets",
  Admin: "admin"
} as const;
export type Tag = (typeof Tag)[keyof typeof Tag];`,
    );
  });

  it('renders string union type', () => {
    expect(renderStyledStringEnumDeclaration('Tag', members, 'union')).toBe(
      `export type Tag = "pets" | "admin";`,
    );
  });
});

describe('formatStyledStringEnumMemberRef', () => {
  const member = { key: 'Pets', value: 'pets' };

  it('uses enum member access by default', () => {
    expect(formatStyledStringEnumMemberRef('Tag', member, undefined)).toBe(
      'Tag.Pets',
    );
  });

  it('uses string literal for union style', () => {
    expect(formatStyledStringEnumMemberRef('Tag', member, 'union')).toBe(
      '"pets"',
    );
  });
});

describe('renderConstObjectTypeDeclaration', () => {
  it('matches data-contract const export shape', () => {
    expect(
      renderConstObjectTypeDeclaration('PetStatusDC', '  Available: "available"', {
        export: true,
      }),
    ).toBe(
      `export const PetStatusDC = {
  Available: "available"
} as const;
export type PetStatusDC = (typeof PetStatusDC)[keyof typeof PetStatusDC];`,
    );
  });
});

describe('usesRuntimeEnumExports', () => {
  it('is false only for union style', () => {
    expect(usesRuntimeEnumExports(undefined)).toBe(true);
    expect(usesRuntimeEnumExports('enum')).toBe(true);
    expect(usesRuntimeEnumExports('const')).toBe(true);
    expect(usesRuntimeEnumExports('union')).toBe(false);
  });
});
