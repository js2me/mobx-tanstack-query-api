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

/** OpenAPI parameter (operation.parameters item or resolved from components.parameters) */
export type OpenAPIParameter = {
  name?: string;
  in?: string;
  required?: boolean;
  schema?: OpenAPISchema;
  type?: string;
  format?: string;
  items?: OpenAPISchema;
};
