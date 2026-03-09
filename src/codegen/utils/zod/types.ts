/** Request parameter shape used when building params schema. */
export type RequestParam = {
  name: string;
  optional?: boolean;
  type: string;
};

/** OpenAPI/JSON Schema subset we use for Zod generation */
export type OpenAPISchema = {
  type?: string;
  $ref?: string;
  allOf?: OpenAPISchema[];
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  items?: OpenAPISchema;
  enum?: unknown[];
  nullable?: boolean;
  format?: string;
  additionalProperties?: boolean | OpenAPISchema;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
};

export const REF_PREFIX = '#/components/schemas/';

/** Minimal shape used to extract response schema $ref; accepts raw OpenAPI operation or route raw. */
export type OperationWithResponses = {
  responses?: Record<
    string,
    { content?: Record<string, { schema?: { $ref?: string } }> }
  >;
};

export interface EndpointZodContractsResult {
  content: string;
  /** Schema var names to import from the central schemas file (e.g. ['appleSchema', 'coreSchema']) */
  zodSchemaImportNames: string[];
}
