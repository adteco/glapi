/**
 * Generalized saved search contracts.
 *
 * Saved searches are ontology-backed query definitions. They are safe metadata
 * definitions, not raw SQL.
 */

import { z } from 'zod';
import {
  ONTOLOGY_REGISTRY,
  getOntologyRecord,
  ontologyFieldKeySchema,
  ontologyRecordKeySchema,
  type OntologyFieldDefinition,
  type OntologyRecordDefinition,
  type OntologyRegistry,
} from '../ontology';

export const savedSearchVisibilitySchema = z.enum(['private', 'shared', 'system']);
export const savedSearchOperatorSchema = z.enum([
  'eq',
  'neq',
  'contains',
  'starts_with',
  'ends_with',
  'in',
  'not_in',
  'is_empty',
  'is_not_empty',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
]);
export const savedSearchSortDirectionSchema = z.enum(['asc', 'desc']);
export const savedSearchAggregateSchema = z.enum(['count', 'sum', 'avg', 'min', 'max']);
export const savedSearchFormulaTypeSchema = z.enum(['text', 'number', 'date', 'boolean']);
export const savedSearchExecutionModeSchema = z.enum(['planned', 'executed']);

export const savedSearchFormulaSchema = z.object({
  key: ontologyFieldKeySchema,
  label: z.string().min(1),
  type: savedSearchFormulaTypeSchema,
  expression: z.string()
    .min(1)
    .max(500)
    .regex(/^[A-Za-z0-9_ .+\-*/()%'"<>=!,?:]+$/),
});

export const savedSearchColumnSchema = z.object({
  fieldKey: ontologyFieldKeySchema.optional(),
  relationshipKey: ontologyRecordKeySchema.optional(),
  label: z.string().min(1).optional(),
  aggregate: savedSearchAggregateSchema.optional(),
  formula: savedSearchFormulaSchema.optional(),
}).refine((column) => Boolean(column.fieldKey) !== Boolean(column.formula), {
  message: 'Column must define exactly one of fieldKey or formula',
});

export const savedSearchFilterSchema = z.object({
  fieldKey: ontologyFieldKeySchema,
  relationshipKey: ontologyRecordKeySchema.optional(),
  operator: savedSearchOperatorSchema,
  value: z.unknown().optional(),
  parameterKey: ontologyFieldKeySchema.optional(),
});

export const savedSearchSortSchema = z.object({
  fieldKey: ontologyFieldKeySchema,
  relationshipKey: ontologyRecordKeySchema.optional(),
  direction: savedSearchSortDirectionSchema.default('asc'),
});

export const savedSearchJoinSchema = z.object({
  relationshipKey: ontologyRecordKeySchema,
  alias: ontologyRecordKeySchema.optional(),
  required: z.boolean().default(false),
});

export const savedSearchDefinitionSchema = z.object({
  recordKey: ontologyRecordKeySchema,
  columns: z.array(savedSearchColumnSchema).min(1),
  filters: z.array(savedSearchFilterSchema).default([]),
  joins: z.array(savedSearchJoinSchema).default([]),
  sort: z.array(savedSearchSortSchema).default([]),
  groupBy: z.array(ontologyFieldKeySchema).default([]),
  pageSize: z.number().int().min(1).max(1000).default(100),
});

export const savedSearchSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  visibility: savedSearchVisibilitySchema.default('private'),
  definition: savedSearchDefinitionSchema,
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createSavedSearchSchema = savedSearchSchema.omit({
  id: true,
  organizationId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSavedSearchSchema = createSavedSearchSchema.partial();

export const runSavedSearchSchema = z.object({
  definition: savedSearchDefinitionSchema.optional(),
  parameters: z.record(z.unknown()).default({}),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(1000).optional(),
});

export const savedSearchValidationIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  path: z.array(z.string()).default([]),
});

export const savedSearchValidationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(savedSearchValidationIssueSchema),
});

export const savedSearchQueryPlanSchema = z.object({
  recordKey: ontologyRecordKeySchema,
  recordLabel: z.string(),
  columns: z.array(z.object({
    key: z.string(),
    label: z.string(),
    aggregate: savedSearchAggregateSchema.optional(),
    relationshipKey: ontologyRecordKeySchema.optional(),
    formula: savedSearchFormulaSchema.optional(),
  })),
  filters: z.array(savedSearchFilterSchema),
  joins: z.array(savedSearchJoinSchema),
  sort: z.array(savedSearchSortSchema),
  groupBy: z.array(ontologyFieldKeySchema),
  pageSize: z.number().int().min(1).max(1000),
});

export const savedSearchRunResultSchema = z.object({
  executionMode: savedSearchExecutionModeSchema,
  plan: savedSearchQueryPlanSchema,
  rows: z.array(z.record(z.unknown())),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(1000),
  totalRows: z.number().int().min(0).optional(),
});

export type SavedSearchVisibility = z.infer<typeof savedSearchVisibilitySchema>;
export type SavedSearchOperator = z.infer<typeof savedSearchOperatorSchema>;
export type SavedSearchSortDirection = z.infer<typeof savedSearchSortDirectionSchema>;
export type SavedSearchAggregate = z.infer<typeof savedSearchAggregateSchema>;
export type SavedSearchFormula = z.infer<typeof savedSearchFormulaSchema>;
export type SavedSearchColumn = z.infer<typeof savedSearchColumnSchema>;
export type SavedSearchFilter = z.infer<typeof savedSearchFilterSchema>;
export type SavedSearchSort = z.infer<typeof savedSearchSortSchema>;
export type SavedSearchJoin = z.infer<typeof savedSearchJoinSchema>;
export type SavedSearchDefinition = z.infer<typeof savedSearchDefinitionSchema>;
export type SavedSearch = z.infer<typeof savedSearchSchema>;
export type CreateSavedSearchInput = z.infer<typeof createSavedSearchSchema>;
export type UpdateSavedSearchInput = z.infer<typeof updateSavedSearchSchema>;
export type RunSavedSearchInput = z.infer<typeof runSavedSearchSchema>;
export type SavedSearchValidationIssue = z.infer<typeof savedSearchValidationIssueSchema>;
export type SavedSearchValidationResult = z.infer<typeof savedSearchValidationResultSchema>;
export type SavedSearchQueryPlan = z.infer<typeof savedSearchQueryPlanSchema>;
export type SavedSearchRunResult = z.infer<typeof savedSearchRunResultSchema>;

function issue(code: string, message: string, path: string[] = []): SavedSearchValidationIssue {
  return { code, message, path };
}

function findField(
  record: OntologyRecordDefinition,
  fieldKey: string,
): OntologyFieldDefinition | undefined {
  return record.fields.find((field) => field.key === fieldKey);
}

function resolveRecordForRelationship(
  baseRecord: OntologyRecordDefinition,
  relationshipKey: string | undefined,
  registry: OntologyRegistry,
): OntologyRecordDefinition | undefined {
  if (!relationshipKey) return baseRecord;

  const relationship = baseRecord.relationships.find((item) => item.key === relationshipKey);
  if (!relationship) return undefined;

  return getOntologyRecord(relationship.targetRecord, registry);
}

export function validateSavedSearchDefinition(
  definition: unknown,
  registry: OntologyRegistry = ONTOLOGY_REGISTRY,
): SavedSearchValidationResult {
  const parsed = savedSearchDefinitionSchema.safeParse(definition);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map((item) =>
        issue(item.code, item.message, item.path.map(String))
      ),
    };
  }

  const issues: SavedSearchValidationIssue[] = [];
  const search = parsed.data;
  const baseRecord = getOntologyRecord(search.recordKey, registry);

  if (!baseRecord) {
    issues.push(issue('unknown_record', `Unknown ontology record "${search.recordKey}"`, ['recordKey']));
    return { valid: false, issues };
  }

  if (!baseRecord.operations.includes('search')) {
    issues.push(issue(
      'record_not_searchable',
      `Ontology record "${search.recordKey}" does not support search`,
      ['recordKey'],
    ));
  }

  const joinKeys = new Set<string>();
  for (const [index, join] of search.joins.entries()) {
    if (joinKeys.has(join.relationshipKey)) {
      issues.push(issue(
        'duplicate_join',
        `Duplicate join "${join.relationshipKey}"`,
        ['joins', String(index), 'relationshipKey'],
      ));
    }
    joinKeys.add(join.relationshipKey);

    if (!baseRecord.relationships.some((item) => item.key === join.relationshipKey)) {
      issues.push(issue(
        'unknown_relationship',
        `Unknown relationship "${join.relationshipKey}" on "${baseRecord.key}"`,
        ['joins', String(index), 'relationshipKey'],
      ));
    }
  }

  for (const [index, column] of search.columns.entries()) {
    if (column.formula) continue;

    const record = resolveRecordForRelationship(baseRecord, column.relationshipKey, registry);
    if (!record) {
      issues.push(issue(
        'unknown_relationship',
        `Unknown relationship "${column.relationshipKey}" on "${baseRecord.key}"`,
        ['columns', String(index), 'relationshipKey'],
      ));
      continue;
    }

    const field = findField(record, column.fieldKey ?? '');
    if (!field) {
      issues.push(issue(
        'unknown_field',
        `Unknown field "${column.fieldKey}" on "${record.key}"`,
        ['columns', String(index), 'fieldKey'],
      ));
      continue;
    }

    if (!field.searchable && !field.filterable && !field.sortable) {
      issues.push(issue(
        'field_not_searchable',
        `Field "${record.key}.${field.key}" is not marked searchable, filterable, or sortable`,
        ['columns', String(index), 'fieldKey'],
      ));
    }
  }

  for (const [index, filter] of search.filters.entries()) {
    const record = resolveRecordForRelationship(baseRecord, filter.relationshipKey, registry);
    const field = record ? findField(record, filter.fieldKey) : undefined;

    if (!record || !field) {
      issues.push(issue(
        'unknown_filter_field',
        `Unknown filter field "${filter.fieldKey}"`,
        ['filters', String(index), 'fieldKey'],
      ));
      continue;
    }

    if (!field.filterable && !field.searchable) {
      issues.push(issue(
        'field_not_filterable',
        `Field "${record.key}.${field.key}" is not filterable`,
        ['filters', String(index), 'fieldKey'],
      ));
    }

    if (
      !['is_empty', 'is_not_empty'].includes(filter.operator)
      && filter.value === undefined
      && !filter.parameterKey
    ) {
      issues.push(issue(
        'missing_filter_value',
        `Filter "${filter.fieldKey}" requires either value or parameterKey`,
        ['filters', String(index)],
      ));
    }
  }

  for (const [index, sort] of search.sort.entries()) {
    const record = resolveRecordForRelationship(baseRecord, sort.relationshipKey, registry);
    const field = record ? findField(record, sort.fieldKey) : undefined;

    if (!record || !field) {
      issues.push(issue(
        'unknown_sort_field',
        `Unknown sort field "${sort.fieldKey}"`,
        ['sort', String(index), 'fieldKey'],
      ));
      continue;
    }

    if (!field.sortable) {
      issues.push(issue(
        'field_not_sortable',
        `Field "${record.key}.${field.key}" is not sortable`,
        ['sort', String(index), 'fieldKey'],
      ));
    }
  }

  for (const [index, fieldKey] of search.groupBy.entries()) {
    const field = findField(baseRecord, fieldKey);
    if (!field) {
      issues.push(issue(
        'unknown_group_field',
        `Unknown group field "${fieldKey}" on "${baseRecord.key}"`,
        ['groupBy', String(index)],
      ));
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function compileSavedSearchQueryPlan(
  definition: SavedSearchDefinition,
  registry: OntologyRegistry = ONTOLOGY_REGISTRY,
): SavedSearchQueryPlan {
  const validation = validateSavedSearchDefinition(definition, registry);
  if (!validation.valid) {
    throw new Error(validation.issues.map((item) => item.message).join('; '));
  }

  const search = savedSearchDefinitionSchema.parse(definition);
  const record = getOntologyRecord(search.recordKey, registry);
  if (!record) {
    throw new Error(`Unknown ontology record "${search.recordKey}"`);
  }

  return {
    recordKey: record.key,
    recordLabel: record.label,
    columns: search.columns.map((column) => {
      if (column.formula) {
        return {
          key: column.formula.key,
          label: column.label ?? column.formula.label,
          aggregate: column.aggregate,
          relationshipKey: column.relationshipKey,
          formula: column.formula,
        };
      }

      const relatedRecord = resolveRecordForRelationship(record, column.relationshipKey, registry);
      const field = relatedRecord
        ? findField(relatedRecord, column.fieldKey ?? '')
        : undefined;

      return {
        key: column.relationshipKey && column.fieldKey
          ? `${column.relationshipKey}.${column.fieldKey}`
          : column.fieldKey ?? '',
        label: column.label ?? field?.label ?? column.fieldKey ?? '',
        aggregate: column.aggregate,
        relationshipKey: column.relationshipKey,
      };
    }),
    filters: search.filters,
    joins: search.joins,
    sort: search.sort,
    groupBy: search.groupBy,
    pageSize: search.pageSize,
  };
}
