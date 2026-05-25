import { describe, expect, it } from 'vitest';
import {
  compileSavedSearchQueryPlan,
  savedSearchDefinitionSchema,
  validateSavedSearchDefinition,
} from '../saved-searches';

const customerSearch = {
  recordKey: 'customer',
  columns: [
    { fieldKey: 'name' },
    { fieldKey: 'email' },
  ],
  filters: [
    { fieldKey: 'status', operator: 'eq', value: 'active' },
  ],
  sort: [
    { fieldKey: 'name', direction: 'asc' },
  ],
};

describe('saved search contracts', () => {
  it('parses and defaults a valid saved search definition', () => {
    const result = savedSearchDefinitionSchema.parse(customerSearch);

    expect(result.recordKey).toBe('customer');
    expect(result.pageSize).toBe(100);
    expect(result.joins).toEqual([]);
  });

  it('validates an ontology-backed saved search', () => {
    const result = validateSavedSearchDefinition(customerSearch);

    expect(result).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('rejects unknown ontology fields', () => {
    const result = validateSavedSearchDefinition({
      recordKey: 'customer',
      columns: [{ fieldKey: 'doesNotExist' }],
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe('unknown_field');
  });

  it('rejects unsafe formulas', () => {
    const result = savedSearchDefinitionSchema.safeParse({
      recordKey: 'customer',
      columns: [
        {
          formula: {
            key: 'unsafeFormula',
            label: 'Unsafe Formula',
            type: 'text',
            expression: 'process.exit(1);',
          },
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('compiles a valid query plan', () => {
    const plan = compileSavedSearchQueryPlan(savedSearchDefinitionSchema.parse(customerSearch));

    expect(plan.recordKey).toBe('customer');
    expect(plan.recordLabel).toBe('Customer');
    expect(plan.columns.map((column) => column.key)).toEqual(['name', 'email']);
  });
});
