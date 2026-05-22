/**
 * Generalized custom record contracts.
 *
 * Custom records are organization-defined ontology records. The contracts here
 * keep the metadata API-first while durable storage is implemented separately.
 */

import { z } from 'zod';
import {
  ONTOLOGY_REGISTRY,
  getOntologyRecord,
  ontologyFieldKeySchema,
  ontologyFieldTypeSchema,
  ontologyRecordKeySchema,
  ontologyRelationshipTypeSchema,
  type OntologyFieldDefinition,
  type OntologyFieldType,
  type OntologyRecordDefinition,
  type OntologyRegistry,
} from '../ontology';

export const customRecordLifecycleSchema = z.enum(['draft', 'active', 'inactive', 'deprecated']);
export const customRecordInstanceLifecycleSchema = z.enum(['active', 'inactive', 'archived']);
export const customRecordNumberingModeSchema = z.enum(['manual', 'auto']);

export const customRecordValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
  z.record(z.unknown()),
]);

export const customRecordFieldValidationRuleSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(0).optional(),
  regex: z.string().optional(),
  enumValues: z.array(z.string().min(1)).optional(),
});

export const customRecordFieldDefinitionSchema = z.object({
  key: ontologyFieldKeySchema,
  label: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  type: ontologyFieldTypeSchema,
  required: z.boolean().default(false),
  readOnly: z.boolean().default(false),
  defaultValue: customRecordValueSchema.optional(),
  searchable: z.boolean().default(false),
  filterable: z.boolean().default(false),
  sortable: z.boolean().default(false),
  enumValues: z.array(z.string().min(1)).optional(),
  referenceTo: ontologyRecordKeySchema.optional(),
  validation: customRecordFieldValidationRuleSchema.default({}),
});

export const customRecordRelationshipSchema = z.object({
  key: ontologyRecordKeySchema,
  label: z.string().min(1).max(120),
  type: ontologyRelationshipTypeSchema,
  targetRecordKey: ontologyRecordKeySchema,
  sourceFieldKey: ontologyFieldKeySchema.optional(),
  targetFieldKey: ontologyFieldKeySchema.optional(),
  description: z.string().max(1000).optional(),
});

export const customRecordPermissionSchema = z.object({
  readRoles: z.array(z.string().min(1)).default([]),
  writeRoles: z.array(z.string().min(1)).default([]),
  adminRoles: z.array(z.string().min(1)).default([]),
});

export const customRecordNumberingSchema = z.object({
  mode: customRecordNumberingModeSchema.default('manual'),
  prefix: z.string().min(1).max(40).optional(),
  nextNumber: z.number().int().min(1).default(1),
  minDigits: z.number().int().min(1).max(20).default(5),
});

export const customRecordTypeDefinitionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  recordKey: ontologyRecordKeySchema,
  label: z.string().min(1).max(120),
  pluralLabel: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  lifecycle: customRecordLifecycleSchema.default('active'),
  fields: z.array(customRecordFieldDefinitionSchema).min(1),
  relationships: z.array(customRecordRelationshipSchema).default([]),
  permissions: customRecordPermissionSchema.default({ readRoles: [], writeRoles: [], adminRoles: [] }),
  numbering: customRecordNumberingSchema.default({ mode: 'manual', nextNumber: 1, minDigits: 5 }),
  nameFieldKey: ontologyFieldKeySchema.optional(),
  searchable: z.boolean().default(true),
  auditEnabled: z.boolean().default(true),
  evented: z.boolean().default(true),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createCustomRecordTypeDefinitionSchema = customRecordTypeDefinitionSchema.omit({
  id: true,
  organizationId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCustomRecordTypeDefinitionSchema = createCustomRecordTypeDefinitionSchema.partial();

export const customRecordSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  recordTypeId: z.string().uuid(),
  recordKey: ontologyRecordKeySchema,
  externalId: z.string().min(1).max(120).optional(),
  name: z.string().min(1).max(240),
  lifecycle: customRecordInstanceLifecycleSchema.default('active'),
  values: z.record(z.unknown()).default({}),
  customFields: z.record(z.unknown()).default({}),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createCustomRecordSchema = z.object({
  recordTypeId: z.string().uuid().optional(),
  recordKey: ontologyRecordKeySchema.optional(),
  externalId: z.string().min(1).max(120).optional(),
  name: z.string().min(1).max(240).optional(),
  lifecycle: customRecordInstanceLifecycleSchema.default('active'),
  values: z.record(z.unknown()).default({}),
  customFields: z.record(z.unknown()).default({}),
}).refine((record) => Boolean(record.recordTypeId) || Boolean(record.recordKey), {
  message: 'recordTypeId or recordKey is required',
  path: ['recordTypeId'],
});

export const updateCustomRecordSchema = z.object({
  externalId: z.string().min(1).max(120).optional(),
  name: z.string().min(1).max(240).optional(),
  lifecycle: customRecordInstanceLifecycleSchema.optional(),
  values: z.record(z.unknown()).optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const customRecordValuesValidationInputSchema = z.object({
  recordTypeId: z.string().uuid().optional(),
  recordKey: ontologyRecordKeySchema.optional(),
  name: z.string().min(1).max(240).optional(),
  values: z.record(z.unknown()).default({}),
  customFields: z.record(z.unknown()).default({}),
}).refine((record) => Boolean(record.recordTypeId) || Boolean(record.recordKey), {
  message: 'recordTypeId or recordKey is required',
  path: ['recordTypeId'],
});

export const customRecordValidationIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  path: z.array(z.string()).default([]),
});

export const customRecordTypeValidationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(customRecordValidationIssueSchema),
});

export const customRecordValuesValidationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(customRecordValidationIssueSchema),
  normalizedValues: z.record(z.unknown()),
});

export type CustomRecordLifecycle = z.infer<typeof customRecordLifecycleSchema>;
export type CustomRecordInstanceLifecycle = z.infer<typeof customRecordInstanceLifecycleSchema>;
export type CustomRecordNumberingMode = z.infer<typeof customRecordNumberingModeSchema>;
export type CustomRecordFieldValidationRule = z.infer<typeof customRecordFieldValidationRuleSchema>;
export type CustomRecordFieldDefinition = z.infer<typeof customRecordFieldDefinitionSchema>;
export type CustomRecordRelationship = z.infer<typeof customRecordRelationshipSchema>;
export type CustomRecordPermission = z.infer<typeof customRecordPermissionSchema>;
export type CustomRecordNumbering = z.infer<typeof customRecordNumberingSchema>;
export type CustomRecordTypeDefinition = z.infer<typeof customRecordTypeDefinitionSchema>;
export type CreateCustomRecordTypeDefinitionInput = z.infer<typeof createCustomRecordTypeDefinitionSchema>;
export type UpdateCustomRecordTypeDefinitionInput = z.infer<typeof updateCustomRecordTypeDefinitionSchema>;
export type CustomRecord = z.infer<typeof customRecordSchema>;
export type CreateCustomRecordInput = z.infer<typeof createCustomRecordSchema>;
export type UpdateCustomRecordInput = z.infer<typeof updateCustomRecordSchema>;
export type CustomRecordValuesValidationInput = z.infer<typeof customRecordValuesValidationInputSchema>;
export type CustomRecordValidationIssue = z.infer<typeof customRecordValidationIssueSchema>;
export type CustomRecordTypeValidationResult = z.infer<typeof customRecordTypeValidationResultSchema>;
export type CustomRecordValuesValidationResult = z.infer<typeof customRecordValuesValidationResultSchema>;

const RESERVED_FIELD_KEYS = new Set([
  'id',
  'organizationId',
  'recordTypeId',
  'recordKey',
  'externalId',
  'name',
  'lifecycle',
  'values',
  'customFields',
  'createdBy',
  'createdAt',
  'updatedAt',
]);

function issue(code: string, message: string, path: string[] = []): CustomRecordValidationIssue {
  return { code, message, path };
}

function customRecordTypeRecordKeys(types: CustomRecordTypeDefinition[]): Set<string> {
  return new Set(
    types
      .filter((type) => type.lifecycle !== 'deprecated')
      .map((type) => type.recordKey),
  );
}

function hasKnownRecord(
  recordKey: string,
  registry: OntologyRegistry,
  customRecordTypeKeys: Set<string>,
): boolean {
  return Boolean(getOntologyRecord(recordKey, registry)) || customRecordTypeKeys.has(recordKey);
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
  field: Pick<CustomRecordFieldDefinition, 'key' | 'type' | 'validation' | 'enumValues'>,
  value: unknown,
): CustomRecordValidationIssue[] {
  const issues: CustomRecordValidationIssue[] = [];
  if (value === null || value === undefined) return issues;

  if (!valueMatchesType(field.type, value)) {
    issues.push(issue(
      'invalid_type',
      `Custom record field "${field.key}" value does not match type "${field.type}"`,
      [field.key],
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
  const enumValues = field.enumValues ?? field.validation.enumValues;

  if (enumValues && stringValue && !enumValues.includes(stringValue)) {
    issues.push(issue(
      'enum_value_not_allowed',
      `Custom record field "${field.key}" must be one of: ${enumValues.join(', ')}`,
      [field.key],
    ));
  }

  if (field.validation.minLength !== undefined && stringValue && stringValue.length < field.validation.minLength) {
    issues.push(issue(
      'min_length',
      `Custom record field "${field.key}" must be at least ${field.validation.minLength} characters`,
      [field.key],
    ));
  }

  if (field.validation.maxLength !== undefined && stringValue && stringValue.length > field.validation.maxLength) {
    issues.push(issue(
      'max_length',
      `Custom record field "${field.key}" must be at most ${field.validation.maxLength} characters`,
      [field.key],
    ));
  }

  if (field.validation.regex && stringValue && !new RegExp(field.validation.regex).test(stringValue)) {
    issues.push(issue(
      'regex_mismatch',
      `Custom record field "${field.key}" does not match required pattern`,
      [field.key],
    ));
  }

  if (field.validation.min !== undefined && numericValue !== undefined && numericValue < field.validation.min) {
    issues.push(issue(
      'min_value',
      `Custom record field "${field.key}" must be at least ${field.validation.min}`,
      [field.key],
    ));
  }

  if (field.validation.max !== undefined && numericValue !== undefined && numericValue > field.validation.max) {
    issues.push(issue(
      'max_value',
      `Custom record field "${field.key}" must be at most ${field.validation.max}`,
      [field.key],
    ));
  }

  return issues;
}

export function validateCustomRecordTypeDefinition(
  definition: unknown,
  existingTypes: CustomRecordTypeDefinition[] = [],
  registry: OntologyRegistry = ONTOLOGY_REGISTRY,
): CustomRecordTypeValidationResult {
  const parsed = createCustomRecordTypeDefinitionSchema.safeParse(definition);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map((item) =>
        issue(item.code, item.message, item.path.map(String))
      ),
    };
  }

  const recordType = parsed.data;
  const issues: CustomRecordValidationIssue[] = [];
  const existingRecordKeys = customRecordTypeRecordKeys(existingTypes);
  const referenceRecordKeys = new Set(existingRecordKeys);
  referenceRecordKeys.add(recordType.recordKey);

  if (getOntologyRecord(recordType.recordKey, registry)) {
    issues.push(issue(
      'record_key_collision',
      `Custom record key "${recordType.recordKey}" collides with a standard ontology record`,
      ['recordKey'],
    ));
  }

  if (existingRecordKeys.has(recordType.recordKey)) {
    issues.push(issue(
      'duplicate_record_key',
      `Custom record type "${recordType.recordKey}" already exists`,
      ['recordKey'],
    ));
  }

  const fieldKeys = new Set<string>();
  for (const [index, field] of recordType.fields.entries()) {
    if (fieldKeys.has(field.key)) {
      issues.push(issue(
        'duplicate_field_key',
        `Duplicate custom record field "${field.key}"`,
        ['fields', String(index), 'key'],
      ));
    }
    fieldKeys.add(field.key);

    if (RESERVED_FIELD_KEYS.has(field.key)) {
      issues.push(issue(
        'reserved_field_key',
        `Custom record field "${field.key}" is reserved`,
        ['fields', String(index), 'key'],
      ));
    }

    if (field.type === 'enum' && !(field.enumValues?.length || field.validation.enumValues?.length)) {
      issues.push(issue(
        'missing_enum_values',
        `Enum custom record field "${field.key}" requires enumValues or validation.enumValues`,
        ['fields', String(index), 'enumValues'],
      ));
    }

    if ((field.type === 'reference' || field.type === 'multi_reference') && !field.referenceTo) {
      issues.push(issue(
        'missing_reference_record',
        `Reference custom record field "${field.key}" requires referenceTo`,
        ['fields', String(index), 'referenceTo'],
      ));
    }

    if (field.referenceTo && !hasKnownRecord(field.referenceTo, registry, referenceRecordKeys)) {
      issues.push(issue(
        'unknown_reference_record',
        `Custom record field "${field.key}" references unknown record "${field.referenceTo}"`,
        ['fields', String(index), 'referenceTo'],
      ));
    }

    if (field.defaultValue !== undefined) {
      issues.push(...validateValueRules(field, field.defaultValue));
    }
  }

  if (recordType.nameFieldKey) {
    const nameField = recordType.fields.find((field) => field.key === recordType.nameFieldKey);
    if (!nameField) {
      issues.push(issue(
        'unknown_name_field',
        `Name field "${recordType.nameFieldKey}" is not defined`,
        ['nameFieldKey'],
      ));
    } else if (nameField.type !== 'string' && nameField.type !== 'text') {
      issues.push(issue(
        'invalid_name_field_type',
        `Name field "${recordType.nameFieldKey}" must be string or text`,
        ['nameFieldKey'],
      ));
    }
  }

  const relationshipKeys = new Set<string>();
  for (const [index, relationship] of recordType.relationships.entries()) {
    if (relationshipKeys.has(relationship.key)) {
      issues.push(issue(
        'duplicate_relationship_key',
        `Duplicate custom record relationship "${relationship.key}"`,
        ['relationships', String(index), 'key'],
      ));
    }
    relationshipKeys.add(relationship.key);

    if (!hasKnownRecord(relationship.targetRecordKey, registry, referenceRecordKeys)) {
      issues.push(issue(
        'unknown_relationship_target',
        `Custom record relationship "${relationship.key}" targets unknown record "${relationship.targetRecordKey}"`,
        ['relationships', String(index), 'targetRecordKey'],
      ));
    }

    if (relationship.sourceFieldKey && !fieldKeys.has(relationship.sourceFieldKey)) {
      issues.push(issue(
        'unknown_relationship_source_field',
        `Custom record relationship "${relationship.key}" uses unknown source field "${relationship.sourceFieldKey}"`,
        ['relationships', String(index), 'sourceFieldKey'],
      ));
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateCustomRecordValues(
  input: Pick<CustomRecordValuesValidationInput, 'values' | 'name'>,
  recordType: CustomRecordTypeDefinition,
): CustomRecordValuesValidationResult {
  const normalizedValues: Record<string, unknown> = {};
  const issues: CustomRecordValidationIssue[] = [];
  const fields = recordType.fields.filter(() => recordType.lifecycle === 'active');
  const fieldByKey = new Map(fields.map((field) => [field.key, field]));

  if (recordType.lifecycle !== 'active') {
    issues.push(issue(
      'record_type_not_active',
      `Custom record type "${recordType.recordKey}" is not active`,
      ['recordKey'],
    ));
  }

  for (const field of fields) {
    const value = input.values[field.key] ?? field.defaultValue;
    if (field.required && (value === undefined || value === null || value === '')) {
      issues.push(issue(
        'required_custom_record_field_missing',
        `Custom record field "${field.key}" is required`,
        [field.key],
      ));
      continue;
    }

    if (value !== undefined) {
      issues.push(...validateValueRules(field, value));
      normalizedValues[field.key] = value;
    }
  }

  for (const key of Object.keys(input.values)) {
    if (!fieldByKey.has(key)) {
      issues.push(issue(
        'unknown_custom_record_field',
        `Custom record field "${key}" is not defined for "${recordType.recordKey}"`,
        [key],
      ));
    }
  }

  if (recordType.numbering.mode === 'manual' && !input.name && !recordType.nameFieldKey) {
    issues.push(issue(
      'name_required',
      `Custom record type "${recordType.recordKey}" requires a name`,
      ['name'],
    ));
  }

  return {
    valid: issues.length === 0,
    issues,
    normalizedValues,
  };
}

export function compileCustomRecordOntologyRecord(
  recordType: CustomRecordTypeDefinition,
): OntologyRecordDefinition {
  const fields: OntologyFieldDefinition[] = [
    { key: 'id', label: 'ID', type: 'uuid', required: true, readOnly: true, searchable: false, filterable: true, sortable: false, system: true },
    { key: 'organizationId', label: 'Organization ID', type: 'string', required: true, readOnly: true, searchable: false, filterable: true, sortable: false, system: true },
    { key: 'recordTypeId', label: 'Record Type ID', type: 'reference', referenceTo: 'custom_record_type', required: true, readOnly: true, searchable: false, filterable: true, sortable: false, system: true },
    { key: 'recordKey', label: 'Record Key', type: 'string', required: true, readOnly: true, searchable: false, filterable: true, sortable: false, system: true },
    { key: 'externalId', label: 'External ID', type: 'string', required: false, readOnly: false, searchable: true, filterable: true, sortable: false, system: true },
    { key: 'name', label: 'Name', type: 'string', required: true, readOnly: false, searchable: true, filterable: true, sortable: true, system: true },
    { key: 'lifecycle', label: 'Lifecycle', type: 'enum', enumValues: customRecordInstanceLifecycleSchema.options, required: false, readOnly: false, searchable: false, filterable: true, sortable: false, system: true },
    { key: 'values', label: 'Values', type: 'json', required: true, readOnly: false, searchable: recordType.searchable, filterable: false, sortable: false, system: true },
    { key: 'customFields', label: 'Custom Fields', type: 'json', required: false, readOnly: false, searchable: recordType.searchable, filterable: false, sortable: false, system: true },
    { key: 'createdAt', label: 'Created At', type: 'datetime', required: false, readOnly: true, searchable: false, filterable: false, sortable: true, system: true },
    { key: 'updatedAt', label: 'Updated At', type: 'datetime', required: false, readOnly: true, searchable: false, filterable: false, sortable: true, system: true },
    ...recordType.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      description: field.description,
      required: field.required,
      readOnly: field.readOnly,
      searchable: field.searchable,
      filterable: field.filterable,
      sortable: field.sortable,
      enumValues: field.enumValues ?? field.validation.enumValues,
      referenceTo: field.referenceTo,
      system: false,
    })),
  ];

  return {
    key: recordType.recordKey,
    label: recordType.label,
    pluralLabel: recordType.pluralLabel,
    category: 'custom',
    storage: 'custom_record',
    tableName: 'custom_records',
    apiPath: `/api/custom-records/${recordType.recordKey}`,
    description: recordType.description ?? `Custom record type ${recordType.label}`,
    lifecycle: recordType.lifecycle === 'deprecated' ? 'deprecated' : recordType.lifecycle,
    ownedByPackage: '@glapi/types/custom-records',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    fields,
    relationships: recordType.relationships.map((relationship) => ({
      key: relationship.key,
      label: relationship.label,
      type: relationship.type,
      targetRecord: relationship.targetRecordKey,
      sourceField: relationship.sourceFieldKey,
      targetField: relationship.targetFieldKey,
      description: relationship.description,
    })),
    events: recordType.evented
      ? ['customRecord.created', 'customRecord.updated', 'customRecord.deleted']
      : [],
    customizable: true,
    extensionOf: 'custom_record',
  };
}
