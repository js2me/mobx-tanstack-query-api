import type { ModelType } from 'swagger-typescript-api';
import type { AnyObject } from 'yummies/types';
import { DEFAULT_DATA_CONTRACT_TYPE_SUFFIX } from './data-contract-type-suffix.js';

const refToTypeName = (
  ref: string,
  formatModelName: (modelName: string) => string,
): string | null => {
  const fromDefinitions = ref.match(/#\/definitions\/([^/]+)$/);
  if (fromDefinitions) {
    return formatModelName(fromDefinitions[1]!);
  }
  const fromComponents = ref.match(/#\/components\/schemas\/([^/]+)$/);
  if (fromComponents) {
    return formatModelName(fromComponents[1]!);
  }
  return null;
};

const schemaToTsType = (
  schema: AnyObject,
  formatModelName: (modelName: string) => string,
): string => {
  if (schema?.$ref) {
    return refToTypeName(String(schema.$ref), formatModelName) ?? 'unknown';
  }
  const t = schema?.type;
  if (t === 'string') {
    return 'string';
  }
  if (t === 'integer' || t === 'number') {
    return 'number';
  }
  if (t === 'boolean') {
    return 'boolean';
  }
  if (t === 'array') {
    const items = schema.items;
    const itemSchema = Array.isArray(items) ? items[0] : items;
    const inner = itemSchema
      ? schemaToTsType(itemSchema as AnyObject, formatModelName)
      : 'unknown';
    return `${inner}[]`;
  }
  if (t === 'object' || schema?.properties) {
    return 'Record<string, any>';
  }
  const add = schema?.additionalProperties;
  if (add && typeof add === 'object') {
    const valType = schemaToTsType(add as AnyObject, formatModelName);
    return `Record<string, ${valType}>`;
  }
  return 'unknown';
};

const objectSchemaToInterfaceBody = (
  def: AnyObject,
  formatModelName: (modelName: string) => string,
): string => {
  const props = (def.properties ?? {}) as Record<string, AnyObject>;
  const required = new Set<string>(
    Array.isArray(def.required) ? def.required : [],
  );
  const lines: string[] = [];

  for (const [key, propSchema] of Object.entries(props)) {
    const optional = required.has(key) ? '' : '?';
    let jsdoc = '';
    if (propSchema.format === 'int32' || propSchema.format === 'int64') {
      jsdoc = `  /** @format ${propSchema.format} */\n`;
    }
    const tsType = schemaToTsType(propSchema, formatModelName);
    lines.push(`${jsdoc}  ${key}${optional}: ${tsType};`);
  }

  return lines.join('\r\n');
};

const findSchemaKeyForModelName = (
  modelName: string,
  definitions: Record<string, AnyObject>,
  formatModelName: (modelName: string) => string,
  typeSuffix: string,
): string | undefined => {
  for (const key of Object.keys(definitions)) {
    if (formatModelName(key) === modelName) {
      return key;
    }
  }
  if (typeSuffix && modelName.endsWith(typeSuffix)) {
    const base = modelName.slice(0, -typeSuffix.length);
    if (definitions[base] != null) {
      return base;
    }
  }
  return undefined;
};

/**
 * swagger-typescript-api can emit `type FooDC = BarDC` for an object schema Foo that should be
 * its own interface (e.g. list item vs `{ data: Foo[] }` wrapper, or request payload vs error).
 * When the spec still defines Foo as `type: object`, rebuild that model as an interface.
 */
export const fixCollapsedObjectTypeAliases = (
  modelTypes: ModelType[],
  swaggerSchema: AnyObject | undefined,
  formatModelName: (modelName: string) => string,
): ModelType[] => {
  const definitions =
    (swaggerSchema?.definitions as Record<string, AnyObject> | undefined) ??
    (swaggerSchema?.components?.schemas as
      | Record<string, AnyObject>
      | undefined) ??
    {};

  if (Object.keys(definitions).length === 0) {
    return modelTypes;
  }

  return modelTypes.map((model) => {
    if (model.typeIdentifier !== 'type') {
      return model;
    }
    const target = model.content?.trim();
    if (!target || !/^[A-Za-z0-9_]+$/.test(target)) {
      return model;
    }

    const schemaKey = findSchemaKeyForModelName(
      model.name,
      definitions,
      formatModelName,
      DEFAULT_DATA_CONTRACT_TYPE_SUFFIX,
    );
    if (schemaKey == null) {
      return model;
    }

    const rawDef = definitions[schemaKey];
    if (rawDef?.type !== 'object' || rawDef.properties == null) {
      return model;
    }

    const body = objectSchemaToInterfaceBody(rawDef, formatModelName);

    return {
      ...model,
      typeIdentifier: 'interface',
      content: body,
    };
  });
};
