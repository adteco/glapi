import { describe, expect, it } from 'vitest';
import {
  compileCustomRecordOntologyRecord,
  createCustomRecordTypeDefinitionSchema,
  validateCustomRecordTypeDefinition,
  validateCustomRecordValues,
  type CustomRecordTypeDefinition,
} from '../custom-records';

const now = new Date().toISOString();

const contractTypeInput = {
  recordKey: 'customer_contract',
  label: 'Customer Contract',
  pluralLabel: 'Customer Contracts',
  description: 'Customer-specific commercial contract metadata.',
  fields: [
    {
      key: 'contractName',
      label: 'Contract Name',
      type: 'string',
      required: true,
      searchable: true,
      sortable: true,
    },
    {
      key: 'customerId',
      label: 'Customer',
      type: 'reference',
      referenceTo: 'customer',
      required: true,
      filterable: true,
    },
    {
      key: 'status',
      label: 'Status',
      type: 'enum',
      required: true,
      enumValues: ['draft', 'active', 'expired'],
      filterable: true,
    },
  ],
  relationships: [
    {
      key: 'customer',
      label: 'Customer',
      type: 'belongs_to',
      targetRecordKey: 'customer',
      sourceFieldKey: 'customerId',
    },
  ],
  nameFieldKey: 'contractName',
};

const contractType: CustomRecordTypeDefinition = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  organizationId: 'org_123',
  createdBy: 'user_123',
  createdAt: now,
  updatedAt: now,
  ...createCustomRecordTypeDefinitionSchema.parse(contractTypeInput),
};

describe('custom record contracts', () => {
  it('parses and defaults custom record type definitions', () => {
    const result = createCustomRecordTypeDefinitionSchema.parse(contractTypeInput);

    expect(result.lifecycle).toBe('active');
    expect(result.numbering.mode).toBe('manual');
    expect(result.searchable).toBe(true);
    expect(result.auditEnabled).toBe(true);
  });

  it('validates ontology-backed custom record type definitions', () => {
    const result = validateCustomRecordTypeDefinition(contractTypeInput);

    expect(result).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('rejects standard record key and reserved field collisions', () => {
    const result = validateCustomRecordTypeDefinition({
      ...contractTypeInput,
      recordKey: 'customer',
      relationships: [],
      nameFieldKey: undefined,
      fields: [
        {
          key: 'name',
          label: 'Name',
          type: 'string',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((item) => item.code)).toEqual([
      'record_key_collision',
      'reserved_field_key',
    ]);
  });

  it('rejects invalid enum and reference fields', () => {
    const result = validateCustomRecordTypeDefinition({
      ...contractTypeInput,
      relationships: [],
      nameFieldKey: undefined,
      fields: [
        {
          key: 'status',
          label: 'Status',
          type: 'enum',
        },
        {
          key: 'ownerId',
          label: 'Owner',
          type: 'reference',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((item) => item.code)).toEqual([
      'missing_enum_values',
      'missing_reference_record',
    ]);
  });

  it('validates custom record values against the type definition', () => {
    const result = validateCustomRecordValues(
      {
        values: {
          contractName: 'MSA 2026',
          customerId: 'customer_123',
          status: 'active',
        },
      },
      contractType,
    );

    expect(result.valid).toBe(true);
    expect(result.normalizedValues).toEqual({
      contractName: 'MSA 2026',
      customerId: 'customer_123',
      status: 'active',
    });
  });

  it('rejects unknown and invalid custom record values', () => {
    const result = validateCustomRecordValues(
      {
        values: {
          contractName: 'MSA 2026',
          customerId: 'customer_123',
          status: 'closed',
          unknownField: true,
        },
      },
      contractType,
    );

    expect(result.valid).toBe(false);
    expect(result.issues.map((item) => item.code)).toEqual([
      'enum_value_not_allowed',
      'unknown_custom_record_field',
    ]);
  });

  it('compiles a custom record type into an ontology record', () => {
    const record = compileCustomRecordOntologyRecord(contractType);

    expect(record).toMatchObject({
      key: 'customer_contract',
      category: 'custom',
      storage: 'custom_record',
      apiPath: '/api/custom-records/customer_contract',
      extensionOf: 'custom_record',
    });
    expect(record.fields.some((field) => field.key === 'contractName' && !field.system)).toBe(true);
    expect(record.relationships[0]).toMatchObject({
      key: 'customer',
      targetRecord: 'customer',
      sourceField: 'customerId',
    });
  });
});
