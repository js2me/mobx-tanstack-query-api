import type { ModelType } from 'swagger-typescript-api';
import type { PartialKeys } from 'yummies/utils/types';

export type TypeInfo = PartialKeys<ModelType, 'rawContent'>;
