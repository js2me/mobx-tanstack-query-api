import type { ModelType } from 'swagger-typescript-api';
import type { PartialKeys } from 'yummies/types';
import type { TypeInfo } from '../types/type-info.js';

export const createShortModelType = (
  shortModelType: PartialKeys<
    ModelType,
    'rawContent' | 'description' | 'typeIdentifier'
  >,
): TypeInfo & ModelType => {
  return {
    ...shortModelType,
    typeIdentifier: shortModelType.typeIdentifier || 'type',
    rawContent: shortModelType.rawContent || shortModelType.content,
    description: shortModelType.description || '',
  };
};
