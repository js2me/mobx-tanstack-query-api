import { describe, expect, it } from 'vitest';
import { parseComponentRef } from './parse-component-ref.js';
import { parseParamRef } from './parse-param-ref.js';
import { parseRef } from './parse-ref.js';
import { parseResponseRef } from './parse-response-ref.js';

describe('parseComponentRef', () => {
  it('parses generic #/components/<section>/<name> refs', () => {
    expect(parseComponentRef('#/components/responses/Foo')).toEqual({
      section: 'responses',
      name: 'Foo',
    });
    expect(parseComponentRef('#/components/lols/Bar')).toEqual({
      section: 'lols',
      name: 'Bar',
    });
  });

  it('returns null for invalid refs', () => {
    expect(parseComponentRef('#/components/schemas/Foo/bar')).toBeNull();
    expect(parseComponentRef('#/paths/Foo')).toBeNull();
    expect(parseComponentRef('foo')).toBeNull();
  });
});

describe('component ref wrappers', () => {
  it('keeps parseRef and parseParamRef section-aware', () => {
    expect(parseRef('#/components/schemas/Foo')).toBe('Foo');
    expect(parseRef('#/components/responses/Foo')).toBeNull();

    expect(parseParamRef('#/components/parameters/Search')).toBe('Search');
    expect(parseParamRef('#/components/lols/Search')).toBeNull();
  });

  it('allows parseResponseRef for any component section', () => {
    expect(parseResponseRef('#/components/responses/Foo')).toBe('Foo');
    expect(parseResponseRef('#/components/lols/Foo')).toBe('Foo');
    expect(parseResponseRef('#/paths/lols/Foo')).toBeNull();
  });
});
