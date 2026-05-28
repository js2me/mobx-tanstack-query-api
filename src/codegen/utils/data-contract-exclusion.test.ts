import { describe, expect, it } from 'vitest';
import {
  collectEndpointLocalDataContractNames,
  computeExcludedDataContractNames,
} from './data-contract-exclusion.js';

describe('data-contract-exclusion', () => {
  it('keeps externally prefixed aliases in data-contracts when referenced from shared contracts', () => {
    const excluded = computeExcludedDataContractNames({
      reservedDataContractNamesMap: new Map([
        ['OpenapiSpecificationContentDC', 1],
        ['ReplaceSpecificationDataDC', 1],
      ]),
      componentsContractNames: new Set(['SpecificationContentDC']),
      modelTypes: [
        {
          name: 'BuildSpecificationBuildSpecificationDC',
          typeIdentifier: 'interface',
          content: 'content?: OpenapiSpecificationContentDC;',
        },
        {
          name: 'OpenapiSpecificationContentDC',
          typeIdentifier: 'type',
          content: 'SpecificationContentSpecificationContentDC',
        },
      ],
    });

    expect(excluded).not.toContain('OpenapiSpecificationContentDC');
    expect(excluded).toContain('ReplaceSpecificationDataDC');
  });

  it('detects references in interface-type content (array of fields)', () => {
    const excluded = computeExcludedDataContractNames({
      reservedDataContractNamesMap: new Map([['OpenapiFooDC', 1]]),
      componentsContractNames: new Set(['BarDC']),
      modelTypes: [
        {
          name: 'BarDC',
          typeIdentifier: 'interface',
          content: [
            { field: '  readonly items?: OpenapiFooDC;' },
            { field: '  readonly name?: string;' },
          ],
        },
        {
          name: 'OpenapiFooDC',
          typeIdentifier: 'type',
          content: '{}',
        },
      ],
    });

    expect(excluded).not.toContain('OpenapiFooDC');
  });

  it('defines only endpoint-reserved non-component types locally', () => {
    const local = collectEndpointLocalDataContractNames({
      dataContactNames: new Set(['MemorySegmentResponseDC']),
      reservedDataContractNames: ['GetMemoryDataDC', 'TestFooErrorDC'],
      endpointAliasTypeNames: ['GetMemoryDataDC'],
    });

    expect(local).toEqual(['TestFooErrorDC']);
  });

  it('does not define shared model types locally when they are not endpoint-reserved', () => {
    const local = collectEndpointLocalDataContractNames({
      dataContactNames: new Set(['MemorySegmentResponseDC']),
      reservedDataContractNames: ['GetMemoryDataDC'],
      endpointAliasTypeNames: ['GetMemoryDataDC'],
    });

    expect(local).toEqual([]);
  });
});
