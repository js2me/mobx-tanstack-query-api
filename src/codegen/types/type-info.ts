import type { ModelType } from 'swagger-typescript-api';
import type { PartialKeys } from 'yummies/types';

export type TypeInfo = PartialKeys<ModelType, 'rawContent'>;
