import { camelCase } from 'es-toolkit';
import { buildEndpointZodContractsCode } from '../../../utils/zod/build-endpoint-zod-contracts-code.js';
import {
  getEndpointZodContractSuffix,
  getZodContractSuffix,
} from '../../../utils/zod/contract-suffix.js';
import type { NewEndpointTmplParams } from '../index.js';

export const buildZodEndpointData = ({
  route,
  zodContracts,
  inputParams,
  defaultOkResponse,
  relativePathZodSchemas,
  dataContractTypeSuffix,
  swaggerSchema,
  responseSchemaKey,
  queryName,
}: NewEndpointTmplParams & {
  inputParams: any;
  defaultOkResponse: string;
  dataContractTypeSuffix: string;
  responseSchemaKey?: any;
  queryName?: any;
}) => {
  const zodContractsIsObject =
    typeof zodContracts === 'object' && zodContracts !== null;
  const hasZodContracts = zodContracts === true || zodContractsIsObject;

  if (!hasZodContracts) {
    return null;
  }

  const sharedContractSuffix = getZodContractSuffix(zodContracts);
  const endpointContractSuffix = getEndpointZodContractSuffix(zodContracts);

  const contractVarName = `${camelCase(route.routeName.usage)}${endpointContractSuffix}`;

  const contractsCode = buildEndpointZodContractsCode({
    routeNameUsage: route.routeName.usage,
    inputParams,
    responseDataTypeName: defaultOkResponse,
    contractVarName: `${camelCase(route.routeName.usage)}${endpointContractSuffix}`,
    componentsSchemas: swaggerSchema.components?.schemas ?? undefined,
    typeSuffix: dataContractTypeSuffix,
    responseSchemaKey: responseSchemaKey ?? undefined,
    useExternalZodSchemas: Boolean(relativePathZodSchemas),
    contractSuffix: sharedContractSuffix,
    openApiOperation: route.raw ?? undefined,
    openApiComponentsParameters:
      swaggerSchema.components?.parameters ?? undefined,
    queryParamName: queryName,
  });

  return {
    contractVarName,
    contractsCode,
  };
};
