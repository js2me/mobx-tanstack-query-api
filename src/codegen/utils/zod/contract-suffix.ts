import type { AnyObject } from 'yummies/types';

export const DEFAULT_ZOD_CONTRACT_SUFFIX = 'Contract';

export function getZodContractSuffix(
  zodContracts: boolean | { suffix?: string } | AnyObject | null | undefined,
): string {
  return (
    (typeof zodContracts === 'object' &&
    zodContracts !== null &&
    typeof zodContracts.suffix === 'string'
      ? zodContracts.suffix
      : undefined) ?? DEFAULT_ZOD_CONTRACT_SUFFIX
  );
}
