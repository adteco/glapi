import { describe, expect, it } from 'vitest';
import {
  createCustomFieldDefinitionSchema,
  validateCustomFieldDefinition,
  validateCustomFieldValues,
  type CustomFieldDefinition,
} from '../custom-fields';

const now = new Date().toISOString();

const customerRegionInput = {
  recordKey: 'customer',
  fieldKey: 'customerRegion',
  label: 'Customer Region',
  type: 'enum',
  searchable: true,
  filterable: true,
  validation: {
    enumValues: ['west', 'central', 'east'],
  },
};

const customerRegionDefinition: CustomFieldDefinition = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  organizationId: 'org_123',
  createdBy: 'user_123',
  createdAt: now,
  updatedAt: now,
  ...createCustomFieldDefinitionSchema.parse(customerRegionInput),
};

describe('custom field contracts', () => {
  it('parses and defaults custom field definitions', () => {
    const result = createCustomFieldDefinitionSchema.parse(customerRegionInput);

    expect(result.lifecycle).toBe('active');
    expect(result.visibleInApi).toBe(true);
    expect(result.ui.displayOrder).toBe(0);
  });

  it('validates an ontology-backed custom field definition', () => {
    const result = validateCustomFieldDefinition(customerRegionInput);

    expect(result).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('rejects system field collisions', () => {
    const result = validateCustomFieldDefinition({
      ...customerRegionInput,
      fieldKey: 'name',
      label: 'Name',
      type: 'string',
      validation: {},
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe('field_key_collision');
  });

  it('rejects enum fields without allowed values', () => {
    const result = validateCustomFieldDefinition({
      ...customerRegionInput,
      validation: {},
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe('missing_enum_values');
  });

  it('validates custom field values against definitions', () => {
    const result = validateCustomFieldValues(
      {
        recordKey: 'customer',
        values: {
          customerRegion: 'west',
        },
      },
      [customerRegionDefinition],
    );

    expect(result.valid).toBe(true);
    expect(result.normalizedValues).toEqual({
      customerRegion: 'west',
    });
  });

  it('rejects unknown and invalid custom field values', () => {
    const result = validateCustomFieldValues(
      {
        recordKey: 'customer',
        values: {
          customerRegion: 'north',
          unknownField: true,
        },
      },
      [customerRegionDefinition],
    );

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'enum_value_not_allowed',
      'unknown_custom_field',
    ]);
  });
});
