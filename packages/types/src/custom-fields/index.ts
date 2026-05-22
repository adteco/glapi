/**
 * Generalized custom field contracts.
 *
 * Custom fields are ontology-backed metadata definitions used to validate each
 * record's customFields payload.
 */

import { z } from 'zod';
import {
  ONTOLOGY_REGISTRY,
  getOntologyRecord,
  ontologyFieldKeySchema,
  ontologyFieldTypeSchema,
  ontologyRecordKeySchema,
  type OntologyFieldType,
  type OntologyRegistry,
} from '../ontology';

export const customFieldLifecycleSchema = z.enum(['draft', 'active', 'inactive', 'deprecated']);
export const customFieldPlacementSchema = z.enum(['body', 'line', 'sublist']);
export const customFieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
  z.record(z.unknown()),
]);

export const customFieldValidationRuleSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(0).optional(),
  regex: z.string().optional(),
  enumValues: z.array(z.string().min(1)).optional(),
  precision: z.number().int().min(0).optional(),
  scale: z.number().int().min(0).optional(),
});

export const customFieldPermissionSchema = z.object({
  readRoles: z.array(z.string().min(1)).default([]),
  writeRoles: z.array(z.string().min(1)).default([]),
});

export const customFieldUiSchema = z.object({
  section: z.string().min(1).optional(),
  helpText: z.string().min(1).optional(),
  placeholder: z.string().min(1).optional(),
  displayOrder: z.number().int().default(0),
});

export const customFieldDefinitionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  recordKey: ontologyRecordKeySchema,
  fieldKey: ontologyFieldKeySchema,
  label: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  type: ontologyFieldTypeSchema,
  lifecycle: customFieldLifecycleSchema.default('active'),
  placement: customFieldPlacementSchema.default('body'),
  required: z.boolean().default(false),
  readOnly: z.boolean().default(false),
  defaultValue: customFieldValueSchema.optional(),
  searchable: z.boolean().default(false),
  filterable: z.boolean().default(false),
  sortable: z.boolean().default(false),
  visibleInApi: z.boolean().default(true),
  referenceTo: ontologyRecordKeySchema.optional(),
  validation: customFieldValidationRuleSchema.default({}),
  permissions: customFieldPermissionSchema.default({ readRoles: [], writeRoles: [] }),
  ui: customFieldUiSchema.default({ displayOrder: 0 }),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createCustomFieldDefinitionSchema = customFieldDefinitionSchema.omit({
  id: true,
  organizationId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCustomFieldDefinitionSchema = createCustomFieldDefinitionSchema.partial();

export const customFieldValidationIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  path: z.array(z.string()).default([]),
});

export const customFieldDefinitionValidationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(customFieldValidationIssueSchema),
});

export const customFieldValuesValidationInputSchema = z.object({
  recordKey: ontologyRecordKeySchema,
  values: z.record(z.unknown()).default({}),
});

export const customFieldValuesValidationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(customFieldValidationIssueSchema),
  normalizedValues: z.record(z.unknown()),
});

export type CustomFieldLifecycle = z.infer<typeof customFieldLifecycleSchema>;
export type CustomFieldPlacement = z.infer<typeof customFieldPlacementSchema>;
export type CustomFieldValue = z.infer<typeof customFieldValueSchema>;
export type CustomFieldValidationRule = z.infer<typeof customFieldValidationRuleSchema>;
export type CustomFieldPermission = z.infer<typeof customFieldPermissionSchema>;
export type CustomFieldUi = z.infer<typeof customFieldUiSchema>;
export type CustomFieldDefinition = z.infer<typeof customFieldDefinitionSchema>;
export type CreateCustomFieldDefinitionInput = z.infer<typeof createCustomFieldDefinitionSchema>;
export type UpdateCustomFieldDefinitionInput = z.infer<typeof updateCustomFieldDefinitionSchema>;
export type CustomFieldValidationIssue = z.infer<typeof customFieldValidationIssueSchema>;
export type CustomFieldDefinitionValidationResult = z.infer<typeof customFieldDefinitionValidationResultSchema>;
export type CustomFieldValuesValidationInput = z.infer<typeof customFieldValuesValidationInputSchema>;
export type CustomFieldValuesValidationResult = z.infer<typeof customFieldValuesValidationResultSchema>;

export type CustomFieldDefinitionValidationOptions = {
  registry?: OntologyRegistry;
  customRecordKeys?: string[];
};

function issue(code: string, message: string, path: string[] = []): CustomFieldValidationIssue {
  return { code, message, path };
}

function isOntologyRegistry(
  value: OntologyRegistry | CustomFieldDefinitionValidationOptions,
): value is OntologyRegistry {
  return Array.isArray((value as OntologyRegistry).records);
}

function valueMatchesType(type: OntologyFieldType, value: unknown): boolean {
  if (value === null || value === undefined) return true;

  switch (type) {
    case 'string':
    case 'text':
    case 'email':
    case 'phone':
    case 'url':
    case 'uuid':
    case 'enum':
    case 'date':
    case 'datetime':
    case 'currency':
    case 'decimal':
      return typeof value === 'string' || typeof value === 'number';
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    case 'reference':
      return typeof value === 'string';
    case 'multi_reference':
      return Array.isArray(value) && value.every((item) => typeof item === 'string');
    case 'json':
    case 'address':
      return typeof value === 'object';
    default:
      return false;
  }
}

function validateValueRules(
  field: Pick<CustomFieldDefinition, 'fieldKey' | 'type' | 'validation'>,
  value: unknown,
): CustomFieldValidationIssue[] {
  const issues: CustomFieldValidationIssue[] = [];
  if (value === null || value === undefined) return issues;

  if (!valueMatchesType(field.type, value)) {
    issues.push(issue(
      'invalid_type',
      `Custom field "${field.fieldKey}" value does not match type "${field.type}"`,
      [field.fieldKey],
    ));
    return issues;
  }

  const stringValue = typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : undefined;
  const numericValue = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : undefined;

  if (field.validation.enumValues && stringValue && !field.validation.enumValues.includes(stringValue)) {
    issues.push(issue(
      'enum_value_not_allowed',
      `Custom field "${field.fieldKey}" must be one of: ${field.validation.enumValues.join(', ')}`,
      [field.fieldKey],
    ));
  }

  if (field.validation.minLength !== undefined && stringValue && stringValue.length < field.validation.minLength) {
    issues.push(issue(
      'min_length',
      `Custom field "${field.fieldKey}" must be at least ${field.validation.minLength} characters`,
      [field.fieldKey],
    ));
  }

  if (field.validation.maxLength !== undefined && stringValue && stringValue.length > field.validation.maxLength) {
    issues.push(issue(
      'max_length',
      `Custom field "${field.fieldKey}" must be at most ${field.validation.maxLength} characters`,
      [field.fieldKey],
    ));
  }

  if (field.validation.regex && stringValue && !new RegExp(field.validation.regex).test(stringValue)) {
    issues.push(issue(
      'regex_mismatch',
      `Custom field "${field.fieldKey}" does not match required pattern`,
      [field.fieldKey],
    ));
  }

  if (field.validation.min !== undefined && numericValue !== undefined && numericValue < field.validation.min) {
    issues.push(issue(
      'min_value',
      `Custom field "${field.fieldKey}" must be at least ${field.validation.min}`,
      [field.fieldKey],
    ));
  }

  if (field.validation.max !== undefined && numericValue !== undefined && numericValue > field.validation.max) {
    issues.push(issue(
      'max_value',
      `Custom field "${field.fieldKey}" must be at most ${field.validation.max}`,
      [field.fieldKey],
    ));
  }

  return issues;
}

export function validateCustomFieldDefinition(
  definition: unknown,
  existingDefinitions: CustomFieldDefinition[] = [],
  registryOrOptions: OntologyRegistry | CustomFieldDefinitionValidationOptions = ONTOLOGY_REGISTRY,
): CustomFieldDefinitionValidationResult {
  const options: CustomFieldDefinitionValidationOptions = isOntologyRegistry(registryOrOptions)
    ? { registry: registryOrOptions, customRecordKeys: [] }
    : {
      registry: registryOrOptions.registry ?? ONTOLOGY_REGISTRY,
      customRecordKeys: registryOrOptions.customRecordKeys ?? [],
    };
  const registry = options.registry;
  const customRecordKeys = new Set(options.customRecordKeys);
  const parsed = createCustomFieldDefinitionSchema.safeParse(definition);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map((item) =>
        issue(item.code, item.message, item.path.map(String))
      ),
    };
  }

  const field = parsed.data;
  const issues: CustomFieldValidationIssue[] = [];
  const record = getOntologyRecord(field.recordKey, registry);
  const isCustomRecord = customRecordKeys.has(field.recordKey);
  if (!record && !isCustomRecord) {
    issues.push(issue('unknown_record', `Unknown ontology record "${field.recordKey}"`, ['recordKey']));
    return { valid: false, issues };
  }

  if (record && !record.customizable) {
    issues.push(issue(
      'record_not_customizable',
      `Ontology record "${field.recordKey}" does not allow custom fields`,
      ['recordKey'],
    ));
  }

  if (record?.fields.some((recordField) => recordField.key === field.fieldKey)) {
    issues.push(issue(
      'field_key_collision',
      `Custom field key "${field.fieldKey}" collides with system field on "${field.recordKey}"`,
      ['fieldKey'],
    ));
  }

  if (
    existingDefinitions.some((existing) =>
      existing.recordKey === field.recordKey
      && existing.fieldKey === field.fieldKey
      && existing.lifecycle !== 'deprecated'
    )
  ) {
    issues.push(issue(
      'duplicate_field_key',
      `Custom field "${field.recordKey}.${field.fieldKey}" already exists`,
      ['fieldKey'],
    ));
  }

  if (
    field.referenceTo
    && !getOntologyRecord(field.referenceTo, registry)
    && !customRecordKeys.has(field.referenceTo)
  ) {
    issues.push(issue(
      'unknown_reference_record',
      `Custom field "${field.fieldKey}" references unknown record "${field.referenceTo}"`,
      ['referenceTo'],
    ));
  }

  if (field.type === 'enum' && !field.validation.enumValues?.length) {
    issues.push(issue(
      'missing_enum_values',
      `Enum custom field "${field.fieldKey}" requires validation.enumValues`,
      ['validation', 'enumValues'],
    ));
  }

  if (field.defaultValue !== undefined) {
    issues.push(...validateValueRules(field, field.defaultValue));
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateCustomFieldValues(
  input: CustomFieldValuesValidationInput,
  definitions: CustomFieldDefinition[],
): CustomFieldValuesValidationResult {
  const matchingDefinitions = definitions.filter((definition) =>
    definition.recordKey === input.recordKey && definition.lifecycle === 'active'
  );
  const definitionByKey = new Map(matchingDefinitions.map((definition) => [definition.fieldKey, definition]));
  const normalizedValues: Record<string, unknown> = {};
  const issues: CustomFieldValidationIssue[] = [];

  for (const definition of matchingDefinitions) {
    const value = input.values[definition.fieldKey] ?? definition.defaultValue;
    if (definition.required && (value === undefined || value === null || value === '')) {
      issues.push(issue(
        'required_custom_field_missing',
        `Custom field "${definition.fieldKey}" is required`,
        [definition.fieldKey],
      ));
      continue;
    }

    if (value !== undefined) {
      issues.push(...validateValueRules(definition, value));
      normalizedValues[definition.fieldKey] = value;
    }
  }

  for (const key of Object.keys(input.values)) {
    if (!definitionByKey.has(key)) {
      issues.push(issue(
        'unknown_custom_field',
        `Custom field "${key}" is not defined for "${input.recordKey}"`,
        [key],
      ));
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    normalizedValues,
  };
}
