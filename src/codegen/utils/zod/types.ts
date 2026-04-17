/** Request parameter shape used when building params schema. */
export type RequestParam = {
  name: string;
  optional?: boolean;
  type: string;
};

export interface EndpointZodContractsResult {
  content: string;
  /** Contract var names to import from the central contracts file (e.g. ['appleContract', 'coreContract']) */
  zodContractImportNames: string[];
}
