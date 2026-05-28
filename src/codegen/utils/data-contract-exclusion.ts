import type { AnyObject } from 'yummies/types';

function contentToString(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) =>
        typeof item === 'object' && item !== null && 'field' in item
          ? String(item.field)
          : '',
      )
      .join(' ');
  }
  return '';
}

function isNameReferencedInContent(name: string, content: string): boolean {
  return content.includes(name);
}

/**
 * Endpoint-level aliases (Op*DataDC, etc.) are kept local to endpoint files.
 * Shared schema aliases (e.g. Openapi*DC from external refs) must stay in
 * data-contracts when referenced from other exported contracts.
 */
export function computeExcludedDataContractNames(params: {
  reservedDataContractNamesMap: Map<string, number>;
  componentsContractNames: Set<string>;
  modelTypes: AnyObject[];
}): string[] {
  const { reservedDataContractNamesMap, componentsContractNames, modelTypes } =
    params;

  const modelTypeNames = new Set(
    modelTypes
      .map((modelType) => modelType.name)
      .filter((name): name is string => typeof name === 'string'),
  );

  let excluded = Array.from(reservedDataContractNamesMap.entries())
    .filter(
      ([name, count]) => count === 1 && !componentsContractNames.has(name),
    )
    .map(([name]) => name);

  let changed = true;
  while (changed) {
    changed = false;
    const referencedFromSharedContracts = new Set<string>();

    for (const contract of modelTypes) {
      if (typeof contract.name !== 'string') {
        continue;
      }
      if (excluded.includes(contract.name)) {
        continue;
      }

      const contentStr = contentToString(contract.content);
      if (!contentStr) {
        continue;
      }

      for (const excludedName of excluded) {
        if (isNameReferencedInContent(excludedName, contentStr)) {
          referencedFromSharedContracts.add(excludedName);
        }
      }
    }

    const mustStayInDataContracts = [...referencedFromSharedContracts].filter(
      (name) => modelTypeNames.has(name) && excluded.includes(name),
    );

    if (mustStayInDataContracts.length > 0) {
      excluded = excluded.filter(
        (name) => !mustStayInDataContracts.includes(name),
      );
      changed = true;
    }
  }

  return excluded;
}

/**
 * Types reserved by a single endpoint and absent from OpenAPI components
 * are emitted locally in that endpoint file instead of data-contracts.ts.
 */
export function collectEndpointLocalDataContractNames(params: {
  dataContactNames: Set<string>;
  reservedDataContractNames: string[];
  endpointAliasTypeNames?: string[];
}): string[] {
  const {
    dataContactNames,
    reservedDataContractNames,
    endpointAliasTypeNames,
  } = params;

  const localNames: string[] = [];

  for (const reservedDataContractName of reservedDataContractNames) {
    if (endpointAliasTypeNames?.includes(reservedDataContractName)) {
      continue;
    }
    if (!dataContactNames.has(reservedDataContractName)) {
      localNames.push(reservedDataContractName);
    }
  }

  return localNames;
}
