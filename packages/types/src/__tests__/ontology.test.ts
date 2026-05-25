/**
 * Tests for the API-first ontology registry.
 */
import { describe, expect, it } from 'vitest';
import {
  ONTOLOGY_REGISTRY,
  assertOntologyRegistry,
  getOntologyRecord,
  isOntologyFieldKey,
  isOntologyRecordKey,
  listOntologyRecords,
  ontologyEventNameSchema,
  ontologyRecordDefinitionSchema,
  ontologyRegistrySchema,
} from '../ontology';

describe('Ontology registry', () => {
  it('validates the standard registry', () => {
    const registry = assertOntologyRegistry();

    expect(registry.version).toBe('2026.05');
    expect(registry.records.length).toBeGreaterThan(20);
  });

  it('uses unique record keys', () => {
    const recordKeys = ONTOLOGY_REGISTRY.records.map((record) => record.key);

    expect(new Set(recordKeys).size).toBe(recordKeys.length);
  });

  it('finds records by key', () => {
    const customer = getOntologyRecord('customer');

    expect(customer?.apiPath).toBe('/api/customers');
    expect(customer?.customizable).toBe(true);
    expect(customer?.operations).toContain('search');
  });

  it('filters records by category and customization support', () => {
    const customizableFinancialRecords = listOntologyRecords({
      category: 'financial',
      customizable: true,
    });

    expect(customizableFinancialRecords.map((record) => record.key)).toContain('account');
    expect(customizableFinancialRecords.map((record) => record.key)).toContain('gl_journal_entry');
    expect(customizableFinancialRecords.map((record) => record.key)).not.toContain('gl_transaction');
  });

  it('defines saved searches as API-addressable ontology records', () => {
    const savedSearch = getOntologyRecord('saved_search');

    expect(savedSearch?.apiPath).toBe('/api/saved-searches');
    expect(savedSearch?.operations).toEqual(
      expect.arrayContaining(['create', 'read', 'update', 'delete', 'list', 'search', 'export']),
    );
  });

  it('rejects duplicate fields on a record', () => {
    const result = ontologyRecordDefinitionSchema.safeParse({
      key: 'example_record',
      label: 'Example Record',
      pluralLabel: 'Example Records',
      category: 'custom',
      storage: 'custom_record',
      description: 'A bad record with duplicate fields.',
      lifecycle: 'active',
      ownedByPackage: '@glapi/types/ontology',
      operations: ['read'],
      fields: [
        { key: 'name', label: 'Name', type: 'string' },
        { key: 'name', label: 'Name Again', type: 'string' },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown relationship targets in a registry', () => {
    const result = ontologyRegistrySchema.safeParse({
      version: '2026.05',
      records: [
        {
          key: 'example_record',
          label: 'Example Record',
          pluralLabel: 'Example Records',
          category: 'custom',
          storage: 'custom_record',
          description: 'A bad record with an unknown relationship target.',
          lifecycle: 'active',
          ownedByPackage: '@glapi/types/ontology',
          operations: ['read'],
          fields: [{ key: 'id', label: 'ID', type: 'uuid' }],
          relationships: [
            {
              key: 'missing_record',
              label: 'Missing Record',
              type: 'belongs_to',
              targetRecord: 'missing_record',
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('enforces naming rules', () => {
    expect(isOntologyRecordKey('business_transaction')).toBe(true);
    expect(isOntologyRecordKey('BusinessTransaction')).toBe(false);
    expect(isOntologyFieldKey('organizationId')).toBe(true);
    expect(isOntologyFieldKey('organization_id')).toBe(false);
    expect(() => ontologyEventNameSchema.parse('invoice.posted')).not.toThrow();
    expect(() => ontologyEventNameSchema.parse('Invoice Posted')).toThrow();
  });
});
