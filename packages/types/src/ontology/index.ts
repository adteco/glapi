/**
 * API-first ontology registry
 *
 * The ontology is the stable contract layer for records, fields, operations,
 * events, and extension points exposed by GLAPI.
 */

import { z } from 'zod';

// ============================================================================
// Naming Schemas
// ============================================================================

export const ontologyVersionSchema = z.string().regex(/^\d{4}\.\d{2}$/);
export const ontologyRecordKeySchema = z.string().regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);
export const ontologyFieldKeySchema = z.string().regex(/^[a-z][A-Za-z0-9]*$/);
export const ontologyEventNameSchema = z.string().regex(/^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)+$/);
export const ontologyApiPathSchema = z.string().regex(/^\/api\/[a-zA-Z0-9/_{}-]+$/);

export type OntologyVersion = z.infer<typeof ontologyVersionSchema>;
export type OntologyRecordKey = z.infer<typeof ontologyRecordKeySchema>;
export type OntologyFieldKey = z.infer<typeof ontologyFieldKeySchema>;
export type OntologyEventName = z.infer<typeof ontologyEventNameSchema>;

// ============================================================================
// Vocabulary
// ============================================================================

export const ontologyRecordCategorySchema = z.enum([
  'entity',
  'list',
  'item',
  'transaction',
  'transaction_line',
  'financial',
  'project',
  'revenue',
  'workflow',
  'system',
  'custom',
]);

export const ontologyRecordStorageSchema = z.enum([
  'table',
  'view',
  'custom_record',
  'external',
]);

export const ontologyFieldTypeSchema = z.enum([
  'string',
  'text',
  'number',
  'decimal',
  'currency',
  'boolean',
  'date',
  'datetime',
  'email',
  'phone',
  'url',
  'uuid',
  'enum',
  'reference',
  'multi_reference',
  'json',
  'address',
]);

export const ontologyLifecycleStateSchema = z.enum([
  'draft',
  'active',
  'inactive',
  'archived',
  'deprecated',
]);

export const ontologyOperationSchema = z.enum([
  'create',
  'read',
  'update',
  'delete',
  'list',
  'search',
  'post',
  'reverse',
  'void',
  'approve',
  'import',
  'export',
]);

export const ontologyRelationshipTypeSchema = z.enum([
  'belongs_to',
  'has_many',
  'has_one',
  'many_to_many',
]);

export type OntologyRecordCategory = z.infer<typeof ontologyRecordCategorySchema>;
export type OntologyRecordStorage = z.infer<typeof ontologyRecordStorageSchema>;
export type OntologyFieldType = z.infer<typeof ontologyFieldTypeSchema>;
export type OntologyLifecycleState = z.infer<typeof ontologyLifecycleStateSchema>;
export type OntologyOperation = z.infer<typeof ontologyOperationSchema>;
export type OntologyRelationshipType = z.infer<typeof ontologyRelationshipTypeSchema>;

// ============================================================================
// Definition Schemas
// ============================================================================

export const ontologyFieldDefinitionSchema = z.object({
  key: ontologyFieldKeySchema,
  label: z.string().min(1),
  type: ontologyFieldTypeSchema,
  description: z.string().min(1).optional(),
  required: z.boolean().default(false),
  readOnly: z.boolean().default(false),
  searchable: z.boolean().default(false),
  filterable: z.boolean().default(false),
  sortable: z.boolean().default(false),
  system: z.boolean().default(true),
  enumValues: z.array(z.string().min(1)).optional(),
  referenceTo: ontologyRecordKeySchema.optional(),
});

export const ontologyRelationshipDefinitionSchema = z.object({
  key: ontologyRecordKeySchema,
  label: z.string().min(1),
  type: ontologyRelationshipTypeSchema,
  targetRecord: ontologyRecordKeySchema,
  sourceField: ontologyFieldKeySchema.optional(),
  targetField: ontologyFieldKeySchema.optional(),
  description: z.string().min(1).optional(),
});

export const ontologyRecordDefinitionSchema = z.object({
  key: ontologyRecordKeySchema,
  label: z.string().min(1),
  pluralLabel: z.string().min(1),
  category: ontologyRecordCategorySchema,
  storage: ontologyRecordStorageSchema,
  tableName: z.string().min(1).optional(),
  apiPath: ontologyApiPathSchema.optional(),
  description: z.string().min(1),
  lifecycle: ontologyLifecycleStateSchema.default('active'),
  ownedByPackage: z.string().min(1),
  operations: z.array(ontologyOperationSchema).min(1),
  fields: z.array(ontologyFieldDefinitionSchema).min(1),
  relationships: z.array(ontologyRelationshipDefinitionSchema).default([]),
  events: z.array(ontologyEventNameSchema).default([]),
  customizable: z.boolean().default(false),
  extensionOf: ontologyRecordKeySchema.optional(),
}).superRefine((record, ctx) => {
  const fieldKeys = new Set<string>();
  for (const field of record.fields) {
    if (fieldKeys.has(field.key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fields'],
        message: `Duplicate field key "${field.key}" on record "${record.key}"`,
      });
    }
    fieldKeys.add(field.key);
  }

  const relationshipKeys = new Set<string>();
  for (const relationship of record.relationships) {
    if (relationshipKeys.has(relationship.key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['relationships'],
        message: `Duplicate relationship key "${relationship.key}" on record "${record.key}"`,
      });
    }
    relationshipKeys.add(relationship.key);
  }
});

export const ontologyRegistrySchema = z.object({
  version: ontologyVersionSchema,
  records: z.array(ontologyRecordDefinitionSchema).min(1),
}).superRefine((registry, ctx) => {
  const recordKeys = new Set<string>();
  for (const record of registry.records) {
    if (recordKeys.has(record.key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['records'],
        message: `Duplicate ontology record key "${record.key}"`,
      });
    }
    recordKeys.add(record.key);
  }

  for (const record of registry.records) {
    for (const field of record.fields) {
      if (field.referenceTo && !recordKeys.has(field.referenceTo)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['records', record.key, 'fields', field.key],
          message: `Field "${record.key}.${field.key}" references unknown record "${field.referenceTo}"`,
        });
      }
    }

    for (const relationship of record.relationships) {
      if (!recordKeys.has(relationship.targetRecord)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['records', record.key, 'relationships', relationship.key],
          message: `Relationship "${record.key}.${relationship.key}" targets unknown record "${relationship.targetRecord}"`,
        });
      }
    }

    if (record.extensionOf && !recordKeys.has(record.extensionOf)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['records', record.key, 'extensionOf'],
        message: `Record "${record.key}" extends unknown record "${record.extensionOf}"`,
      });
    }
  }
});

export type OntologyFieldDefinition = z.infer<typeof ontologyFieldDefinitionSchema>;
export type OntologyRelationshipDefinition = z.infer<typeof ontologyRelationshipDefinitionSchema>;
export type OntologyRecordDefinition = z.infer<typeof ontologyRecordDefinitionSchema>;
export type OntologyRegistry = z.infer<typeof ontologyRegistrySchema>;
type OntologyFieldDefinitionInput = z.input<typeof ontologyFieldDefinitionSchema>;
type OntologyRelationshipDefinitionInput = z.input<typeof ontologyRelationshipDefinitionSchema>;
type OntologyRecordDefinitionInput = z.input<typeof ontologyRecordDefinitionSchema>;

// ============================================================================
// Standard Registry
// ============================================================================

const baseFields: OntologyFieldDefinitionInput[] = [
  {
    key: 'id',
    label: 'ID',
    type: 'uuid',
    required: true,
    readOnly: true,
    searchable: true,
    filterable: true,
    sortable: true,
  },
  {
    key: 'organizationId',
    label: 'Organization ID',
    type: 'string',
    required: true,
    readOnly: true,
    filterable: true,
  },
  {
    key: 'externalId',
    label: 'External ID',
    type: 'string',
    searchable: true,
    filterable: true,
  },
  {
    key: 'customFields',
    label: 'Custom Fields',
    type: 'json',
    description: 'Validated values for organization-defined custom fields.',
    searchable: true,
    filterable: true,
    system: false,
  },
];

const auditFields: OntologyFieldDefinitionInput[] = [
  {
    key: 'createdAt',
    label: 'Created At',
    type: 'datetime',
    required: true,
    readOnly: true,
    filterable: true,
    sortable: true,
  },
  {
    key: 'updatedAt',
    label: 'Updated At',
    type: 'datetime',
    required: true,
    readOnly: true,
    filterable: true,
    sortable: true,
  },
];

const namedFields: OntologyFieldDefinitionInput[] = [
  {
    key: 'name',
    label: 'Name',
    type: 'string',
    required: true,
    searchable: true,
    filterable: true,
    sortable: true,
  },
  {
    key: 'displayName',
    label: 'Display Name',
    type: 'string',
    searchable: true,
    filterable: true,
    sortable: true,
  },
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    enumValues: ['active', 'inactive', 'archived'],
    filterable: true,
    sortable: true,
  },
];

function standardRecord(
  record: Omit<OntologyRecordDefinitionInput, 'lifecycle' | 'fields' | 'relationships' | 'events' | 'customizable'> & {
    fields?: OntologyFieldDefinitionInput[];
    relationships?: OntologyRelationshipDefinitionInput[];
    events?: OntologyEventName[];
    lifecycle?: OntologyLifecycleState;
    customizable?: boolean;
  },
): OntologyRecordDefinition {
  return ontologyRecordDefinitionSchema.parse({
    lifecycle: 'active',
    fields: [...baseFields, ...auditFields, ...(record.fields ?? [])],
    relationships: [],
    events: [],
    customizable: false,
    ...record,
  });
}

function namedRecord(
  record: Parameters<typeof standardRecord>[0],
): OntologyRecordDefinition {
  return standardRecord({
    ...record,
    fields: [...namedFields, ...(record.fields ?? [])],
  });
}

export const STANDARD_ONTOLOGY_RECORDS: OntologyRecordDefinition[] = [
  namedRecord({
    key: 'customer',
    label: 'Customer',
    pluralLabel: 'Customers',
    category: 'entity',
    storage: 'table',
    tableName: 'entities',
    apiPath: '/api/customers',
    description: 'A customer, account, or buying organization.',
    ownedByPackage: '@glapi/types/entities',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    fields: [
      { key: 'email', label: 'Email', type: 'email', searchable: true, filterable: true },
      { key: 'phone', label: 'Phone', type: 'phone', searchable: true },
      { key: 'website', label: 'Website', type: 'url' },
      { key: 'address', label: 'Address', type: 'address', searchable: true },
    ],
    relationships: [
      { key: 'contacts', label: 'Contacts', type: 'has_many', targetRecord: 'contact', targetField: 'customerId' },
      { key: 'invoices', label: 'Invoices', type: 'has_many', targetRecord: 'invoice', targetField: 'entityId' },
    ],
    events: ['customer.created', 'customer.updated', 'customer.archived'],
    customizable: true,
  }),
  namedRecord({
    key: 'vendor',
    label: 'Vendor',
    pluralLabel: 'Vendors',
    category: 'entity',
    storage: 'table',
    tableName: 'entities',
    apiPath: '/api/vendors',
    description: 'A supplier, contractor, or payee.',
    ownedByPackage: '@glapi/types/entities',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    fields: [
      { key: 'email', label: 'Email', type: 'email', searchable: true, filterable: true },
      { key: 'phone', label: 'Phone', type: 'phone', searchable: true },
      { key: 'defaultExpenseAccountId', label: 'Default Expense Account ID', type: 'reference', referenceTo: 'account', filterable: true },
    ],
    events: ['vendor.created', 'vendor.updated', 'vendor.archived'],
    customizable: true,
  }),
  namedRecord({
    key: 'employee',
    label: 'Employee',
    pluralLabel: 'Employees',
    category: 'entity',
    storage: 'table',
    tableName: 'entities',
    apiPath: '/api/employees',
    description: 'A worker, approver, or internal resource.',
    ownedByPackage: '@glapi/types/entities',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    fields: [
      { key: 'email', label: 'Email', type: 'email', searchable: true, filterable: true },
      { key: 'departmentId', label: 'Department ID', type: 'reference', referenceTo: 'department', filterable: true },
    ],
    events: ['employee.created', 'employee.updated', 'employee.archived'],
    customizable: true,
  }),
  namedRecord({
    key: 'contact',
    label: 'Contact',
    pluralLabel: 'Contacts',
    category: 'entity',
    storage: 'table',
    tableName: 'entities',
    apiPath: '/api/contacts',
    description: 'A person related to a customer, vendor, employee, or project.',
    ownedByPackage: '@glapi/types/entities',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    fields: [
      { key: 'email', label: 'Email', type: 'email', searchable: true, filterable: true },
      { key: 'phone', label: 'Phone', type: 'phone', searchable: true },
      { key: 'customerId', label: 'Customer ID', type: 'reference', referenceTo: 'customer', filterable: true },
    ],
    relationships: [
      { key: 'customer', label: 'Customer', type: 'belongs_to', targetRecord: 'customer', sourceField: 'customerId' },
    ],
    events: ['contact.created', 'contact.updated', 'contact.archived'],
    customizable: true,
  }),
  namedRecord({
    key: 'lead',
    label: 'Lead',
    pluralLabel: 'Leads',
    category: 'entity',
    storage: 'table',
    tableName: 'entities',
    apiPath: '/api/leads',
    description: 'A potential customer before qualification.',
    ownedByPackage: '@glapi/types/entities',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    fields: [
      { key: 'email', label: 'Email', type: 'email', searchable: true, filterable: true },
      { key: 'source', label: 'Source', type: 'string', searchable: true, filterable: true },
    ],
    events: ['lead.created', 'lead.updated', 'lead.converted'],
    customizable: true,
  }),
  namedRecord({
    key: 'prospect',
    label: 'Prospect',
    pluralLabel: 'Prospects',
    category: 'entity',
    storage: 'table',
    tableName: 'entities',
    apiPath: '/api/prospects',
    description: 'A qualified potential customer.',
    ownedByPackage: '@glapi/types/entities',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    fields: [
      { key: 'email', label: 'Email', type: 'email', searchable: true, filterable: true },
      { key: 'salesRepId', label: 'Sales Rep ID', type: 'reference', referenceTo: 'employee', filterable: true },
    ],
    events: ['prospect.created', 'prospect.updated', 'prospect.converted'],
    customizable: true,
  }),
  namedRecord({
    key: 'account',
    label: 'Account',
    pluralLabel: 'Accounts',
    category: 'financial',
    storage: 'table',
    tableName: 'accounts',
    apiPath: '/api/accounts',
    description: 'A general ledger account.',
    ownedByPackage: '@glapi/types/accounting',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    fields: [
      { key: 'accountNumber', label: 'Account Number', type: 'string', required: true, searchable: true, filterable: true, sortable: true },
      { key: 'accountType', label: 'Account Type', type: 'enum', required: true, enumValues: ['asset', 'liability', 'equity', 'income', 'expense'], filterable: true },
      { key: 'parentAccountId', label: 'Parent Account ID', type: 'reference', referenceTo: 'account', filterable: true },
    ],
    relationships: [
      { key: 'parent_account', label: 'Parent Account', type: 'belongs_to', targetRecord: 'account', sourceField: 'parentAccountId' },
    ],
    events: ['account.created', 'account.updated', 'account.archived'],
    customizable: true,
  }),
  namedRecord({
    key: 'department',
    label: 'Department',
    pluralLabel: 'Departments',
    category: 'list',
    storage: 'table',
    tableName: 'departments',
    apiPath: '/api/departments',
    description: 'A financial dimension for responsibility centers.',
    ownedByPackage: '@glapi/types/accounting-lists',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    customizable: true,
  }),
  namedRecord({
    key: 'class',
    label: 'Class',
    pluralLabel: 'Classes',
    category: 'list',
    storage: 'table',
    tableName: 'classes',
    apiPath: '/api/classes',
    description: 'A financial dimension for products, services, or reporting categories.',
    ownedByPackage: '@glapi/types/accounting-lists',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    customizable: true,
  }),
  namedRecord({
    key: 'location',
    label: 'Location',
    pluralLabel: 'Locations',
    category: 'list',
    storage: 'table',
    tableName: 'locations',
    apiPath: '/api/locations',
    description: 'A financial or operational location dimension.',
    ownedByPackage: '@glapi/types/accounting-lists',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    customizable: true,
  }),
  namedRecord({
    key: 'subsidiary',
    label: 'Subsidiary',
    pluralLabel: 'Subsidiaries',
    category: 'list',
    storage: 'table',
    tableName: 'subsidiaries',
    apiPath: '/api/subsidiaries',
    description: 'A legal entity or book-owning organization unit.',
    ownedByPackage: '@glapi/types/accounting-lists',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    customizable: true,
  }),
  namedRecord({
    key: 'item',
    label: 'Item',
    pluralLabel: 'Items',
    category: 'item',
    storage: 'table',
    tableName: 'items',
    apiPath: '/api/items',
    description: 'A product, service, kit, or chargeable item.',
    ownedByPackage: '@glapi/types/items',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    fields: [
      { key: 'itemType', label: 'Item Type', type: 'enum', required: true, enumValues: ['inventory', 'non_inventory', 'service', 'kit'], filterable: true },
      { key: 'incomeAccountId', label: 'Income Account ID', type: 'reference', referenceTo: 'account', filterable: true },
      { key: 'expenseAccountId', label: 'Expense Account ID', type: 'reference', referenceTo: 'account', filterable: true },
    ],
    events: ['item.created', 'item.updated', 'item.archived'],
    customizable: true,
  }),
  namedRecord({
    key: 'warehouse',
    label: 'Warehouse',
    pluralLabel: 'Warehouses',
    category: 'item',
    storage: 'table',
    tableName: 'warehouses',
    apiPath: '/api/warehouses',
    description: 'A physical or logical inventory location.',
    ownedByPackage: '@glapi/types/items',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search'],
    customizable: true,
  }),
  namedRecord({
    key: 'price_list',
    label: 'Price List',
    pluralLabel: 'Price Lists',
    category: 'item',
    storage: 'table',
    tableName: 'price_lists',
    apiPath: '/api/price-lists',
    description: 'A named set of item prices.',
    ownedByPackage: '@glapi/types/items',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    fields: [
      { key: 'currencyCode', label: 'Currency Code', type: 'string', required: true, filterable: true },
    ],
    customizable: true,
  }),
  namedRecord({
    key: 'unit_of_measure',
    label: 'Unit of Measure',
    pluralLabel: 'Units of Measure',
    category: 'item',
    storage: 'table',
    tableName: 'units_of_measure',
    apiPath: '/api/units-of-measure',
    description: 'A unit used for item quantities, billing, and inventory movement.',
    ownedByPackage: '@glapi/types/items',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search'],
    customizable: true,
  }),
  standardRecord({
    key: 'business_transaction',
    label: 'Business Transaction',
    pluralLabel: 'Business Transactions',
    category: 'transaction',
    storage: 'table',
    tableName: 'business_transactions',
    apiPath: '/api/transactions',
    description: 'A commercial transaction such as an invoice, order, bill, or estimate.',
    ownedByPackage: '@glapi/types/transactions',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'approve', 'post', 'void', 'import', 'export'],
    fields: [
      { key: 'transactionNumber', label: 'Transaction Number', type: 'string', required: true, searchable: true, filterable: true, sortable: true },
      { key: 'transactionTypeId', label: 'Transaction Type ID', type: 'uuid', required: true, filterable: true },
      { key: 'transactionDate', label: 'Transaction Date', type: 'date', required: true, filterable: true, sortable: true },
      { key: 'entityId', label: 'Entity ID', type: 'reference', referenceTo: 'customer', filterable: true },
      { key: 'currencyCode', label: 'Currency Code', type: 'string', required: true, filterable: true },
      { key: 'totalAmount', label: 'Total Amount', type: 'currency', required: true, filterable: true, sortable: true },
      { key: 'status', label: 'Status', type: 'enum', enumValues: ['draft', 'pending_approval', 'approved', 'posted', 'paid', 'closed', 'cancelled'], filterable: true, sortable: true },
    ],
    relationships: [
      { key: 'entity', label: 'Entity', type: 'belongs_to', targetRecord: 'customer', sourceField: 'entityId' },
      { key: 'lines', label: 'Lines', type: 'has_many', targetRecord: 'business_transaction_line', targetField: 'businessTransactionId' },
      { key: 'gl_transaction', label: 'GL Transaction', type: 'has_one', targetRecord: 'gl_transaction', targetField: 'sourceTransactionId' },
    ],
    events: ['businessTransaction.created', 'businessTransaction.approved', 'businessTransaction.posted', 'businessTransaction.voided'],
    customizable: true,
  }),
  standardRecord({
    key: 'business_transaction_line',
    label: 'Business Transaction Line',
    pluralLabel: 'Business Transaction Lines',
    category: 'transaction_line',
    storage: 'table',
    tableName: 'business_transaction_lines',
    apiPath: '/api/transactions/{transactionId}/lines',
    description: 'A line-level economic detail on a business transaction.',
    ownedByPackage: '@glapi/types/transactions',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search'],
    fields: [
      { key: 'businessTransactionId', label: 'Business Transaction ID', type: 'reference', referenceTo: 'business_transaction', required: true, filterable: true },
      { key: 'lineNumber', label: 'Line Number', type: 'number', required: true, sortable: true },
      { key: 'itemId', label: 'Item ID', type: 'reference', referenceTo: 'item', filterable: true },
      { key: 'accountId', label: 'Account ID', type: 'reference', referenceTo: 'account', filterable: true },
      { key: 'quantity', label: 'Quantity', type: 'decimal', filterable: true },
      { key: 'lineAmount', label: 'Line Amount', type: 'currency', required: true, filterable: true, sortable: true },
    ],
    relationships: [
      { key: 'business_transaction', label: 'Business Transaction', type: 'belongs_to', targetRecord: 'business_transaction', sourceField: 'businessTransactionId' },
      { key: 'item', label: 'Item', type: 'belongs_to', targetRecord: 'item', sourceField: 'itemId' },
    ],
    events: ['businessTransactionLine.created', 'businessTransactionLine.updated'],
    customizable: true,
  }),
  standardRecord({
    key: 'invoice',
    label: 'Invoice',
    pluralLabel: 'Invoices',
    category: 'transaction',
    storage: 'view',
    tableName: 'business_transactions',
    apiPath: '/api/invoices',
    description: 'A receivable transaction presented to a customer.',
    ownedByPackage: '@glapi/types/transactions',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'approve', 'post', 'void', 'import', 'export'],
    fields: [
      { key: 'transactionNumber', label: 'Invoice Number', type: 'string', required: true, searchable: true, filterable: true, sortable: true },
      { key: 'customerId', label: 'Customer ID', type: 'reference', referenceTo: 'customer', required: true, filterable: true },
      { key: 'invoiceDate', label: 'Invoice Date', type: 'date', required: true, filterable: true, sortable: true },
      { key: 'dueDate', label: 'Due Date', type: 'date', filterable: true, sortable: true },
      { key: 'totalAmount', label: 'Total Amount', type: 'currency', required: true, filterable: true, sortable: true },
    ],
    relationships: [
      { key: 'customer', label: 'Customer', type: 'belongs_to', targetRecord: 'customer', sourceField: 'customerId' },
    ],
    events: ['invoice.created', 'invoice.approved', 'invoice.posted', 'invoice.voided'],
    customizable: true,
    extensionOf: 'business_transaction',
  }),
  standardRecord({
    key: 'payment',
    label: 'Payment',
    pluralLabel: 'Payments',
    category: 'transaction',
    storage: 'table',
    tableName: 'payments',
    apiPath: '/api/payments',
    description: 'A cash receipt, cash disbursement, or applied payment.',
    ownedByPackage: '@glapi/types/transactions',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'post', 'void', 'import', 'export'],
    fields: [
      { key: 'paymentNumber', label: 'Payment Number', type: 'string', searchable: true, filterable: true, sortable: true },
      { key: 'entityId', label: 'Entity ID', type: 'reference', referenceTo: 'customer', filterable: true },
      { key: 'paymentDate', label: 'Payment Date', type: 'date', required: true, filterable: true, sortable: true },
      { key: 'amount', label: 'Amount', type: 'currency', required: true, filterable: true, sortable: true },
    ],
    events: ['payment.created', 'payment.posted', 'payment.voided'],
    customizable: true,
  }),
  standardRecord({
    key: 'subscription',
    label: 'Subscription',
    pluralLabel: 'Subscriptions',
    category: 'revenue',
    storage: 'table',
    tableName: 'subscriptions',
    apiPath: '/api/subscriptions',
    description: 'A recurring customer arrangement used for billing and revenue recognition.',
    ownedByPackage: '@glapi/types/revenue',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    fields: [
      { key: 'customerId', label: 'Customer ID', type: 'reference', referenceTo: 'customer', required: true, filterable: true },
      { key: 'startDate', label: 'Start Date', type: 'date', required: true, filterable: true, sortable: true },
      { key: 'endDate', label: 'End Date', type: 'date', filterable: true, sortable: true },
      { key: 'status', label: 'Status', type: 'enum', enumValues: ['draft', 'active', 'paused', 'cancelled', 'expired'], filterable: true },
    ],
    relationships: [
      { key: 'customer', label: 'Customer', type: 'belongs_to', targetRecord: 'customer', sourceField: 'customerId' },
    ],
    events: ['subscription.created', 'subscription.activated', 'subscription.cancelled'],
    customizable: true,
  }),
  standardRecord({
    key: 'revenue_arrangement',
    label: 'Revenue Arrangement',
    pluralLabel: 'Revenue Arrangements',
    category: 'revenue',
    storage: 'table',
    tableName: 'revenue_arrangements',
    apiPath: '/api/revenue-arrangements',
    description: 'A revenue contract or arrangement with performance obligations.',
    ownedByPackage: '@glapi/types/revenue',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'post', 'import', 'export'],
    fields: [
      { key: 'customerId', label: 'Customer ID', type: 'reference', referenceTo: 'customer', required: true, filterable: true },
      { key: 'arrangementDate', label: 'Arrangement Date', type: 'date', required: true, filterable: true, sortable: true },
      { key: 'totalContractValue', label: 'Total Contract Value', type: 'currency', required: true, filterable: true, sortable: true },
    ],
    events: ['revenueArrangement.created', 'revenueArrangement.updated', 'revenueArrangement.posted'],
    customizable: true,
  }),
  standardRecord({
    key: 'gl_transaction',
    label: 'GL Transaction',
    pluralLabel: 'GL Transactions',
    category: 'financial',
    storage: 'table',
    tableName: 'gl_transactions',
    apiPath: '/api/gl-transactions',
    description: 'An immutable accounting event posted to the general ledger.',
    ownedByPackage: '@glapi/types/accounting',
    operations: ['read', 'list', 'search', 'reverse', 'export'],
    fields: [
      { key: 'transactionNumber', label: 'Transaction Number', type: 'string', required: true, searchable: true, filterable: true, sortable: true },
      { key: 'transactionDate', label: 'Transaction Date', type: 'date', required: true, filterable: true, sortable: true },
      { key: 'sourceTransactionId', label: 'Source Transaction ID', type: 'uuid', filterable: true },
      { key: 'postedAt', label: 'Posted At', type: 'datetime', required: true, readOnly: true, filterable: true, sortable: true },
    ],
    relationships: [
      { key: 'lines', label: 'Lines', type: 'has_many', targetRecord: 'gl_transaction_line', targetField: 'glTransactionId' },
    ],
    events: ['glTransaction.posted', 'glTransaction.reversed'],
    customizable: false,
  }),
  standardRecord({
    key: 'gl_transaction_line',
    label: 'GL Transaction Line',
    pluralLabel: 'GL Transaction Lines',
    category: 'financial',
    storage: 'table',
    tableName: 'gl_transaction_lines',
    apiPath: '/api/gl-transactions/{transactionId}/lines',
    description: 'A debit or credit line on an immutable GL transaction.',
    ownedByPackage: '@glapi/types/accounting',
    operations: ['read', 'list', 'search', 'export'],
    fields: [
      { key: 'glTransactionId', label: 'GL Transaction ID', type: 'reference', referenceTo: 'gl_transaction', required: true, filterable: true },
      { key: 'accountId', label: 'Account ID', type: 'reference', referenceTo: 'account', required: true, filterable: true },
      { key: 'debitAmount', label: 'Debit Amount', type: 'currency', required: true, filterable: true, sortable: true },
      { key: 'creditAmount', label: 'Credit Amount', type: 'currency', required: true, filterable: true, sortable: true },
      { key: 'postingDate', label: 'Posting Date', type: 'date', required: true, filterable: true, sortable: true },
    ],
    relationships: [
      { key: 'gl_transaction', label: 'GL Transaction', type: 'belongs_to', targetRecord: 'gl_transaction', sourceField: 'glTransactionId' },
      { key: 'account', label: 'Account', type: 'belongs_to', targetRecord: 'account', sourceField: 'accountId' },
    ],
    events: ['glTransactionLine.posted'],
    customizable: false,
  }),
  standardRecord({
    key: 'gl_journal_entry',
    label: 'GL Journal Entry',
    pluralLabel: 'GL Journal Entries',
    category: 'financial',
    storage: 'view',
    tableName: 'gl_transactions',
    apiPath: '/api/gl-journal-entries',
    description: 'A manually entered GL transaction.',
    ownedByPackage: '@glapi/types/accounting',
    operations: ['create', 'read', 'list', 'search', 'post', 'reverse', 'import', 'export'],
    fields: [
      { key: 'journalNumber', label: 'Journal Number', type: 'string', searchable: true, filterable: true, sortable: true },
      { key: 'postingDate', label: 'Posting Date', type: 'date', required: true, filterable: true, sortable: true },
      { key: 'memo', label: 'Memo', type: 'text', searchable: true },
    ],
    events: ['glJournalEntry.created', 'glJournalEntry.posted', 'glJournalEntry.reversed'],
    customizable: true,
    extensionOf: 'gl_transaction',
  }),
  namedRecord({
    key: 'project',
    label: 'Project',
    pluralLabel: 'Projects',
    category: 'project',
    storage: 'table',
    tableName: 'projects',
    apiPath: '/api/projects',
    description: 'A project, job, or work breakdown root.',
    ownedByPackage: '@glapi/types/project-tasks',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    fields: [
      { key: 'customerId', label: 'Customer ID', type: 'reference', referenceTo: 'customer', filterable: true },
      { key: 'startDate', label: 'Start Date', type: 'date', filterable: true, sortable: true },
      { key: 'endDate', label: 'End Date', type: 'date', filterable: true, sortable: true },
    ],
    events: ['project.created', 'project.updated', 'project.closed'],
    customizable: true,
  }),
  standardRecord({
    key: 'project_budget',
    label: 'Project Budget',
    pluralLabel: 'Project Budgets',
    category: 'project',
    storage: 'table',
    tableName: 'project_budgets',
    apiPath: '/api/project-budgets',
    description: 'A versioned budget for project cost, revenue, and margin control.',
    ownedByPackage: '@glapi/types/project-tasks',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'approve', 'import', 'export'],
    fields: [
      { key: 'projectId', label: 'Project ID', type: 'reference', referenceTo: 'project', required: true, filterable: true },
      { key: 'version', label: 'Version', type: 'number', required: true, filterable: true, sortable: true },
      { key: 'totalBudget', label: 'Total Budget', type: 'currency', required: true, filterable: true, sortable: true },
    ],
    relationships: [
      { key: 'project', label: 'Project', type: 'belongs_to', targetRecord: 'project', sourceField: 'projectId' },
    ],
    events: ['projectBudget.created', 'projectBudget.approved', 'projectBudget.revised'],
    customizable: true,
  }),
  standardRecord({
    key: 'schedule_of_values',
    label: 'Schedule of Values',
    pluralLabel: 'Schedules of Values',
    category: 'project',
    storage: 'table',
    tableName: 'schedules_of_values',
    apiPath: '/api/schedules-of-values',
    description: 'A contract billing breakdown used by construction workflows.',
    ownedByPackage: '@glapi/types/project-tasks',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'approve', 'import', 'export'],
    fields: [
      { key: 'projectId', label: 'Project ID', type: 'reference', referenceTo: 'project', required: true, filterable: true },
      { key: 'contractValue', label: 'Contract Value', type: 'currency', required: true, filterable: true, sortable: true },
    ],
    events: ['scheduleOfValues.created', 'scheduleOfValues.approved', 'scheduleOfValues.revised'],
    customizable: true,
  }),
  standardRecord({
    key: 'pay_application',
    label: 'Pay Application',
    pluralLabel: 'Pay Applications',
    category: 'project',
    storage: 'table',
    tableName: 'pay_applications',
    apiPath: '/api/pay-applications',
    description: 'A progress billing request against a schedule of values.',
    ownedByPackage: '@glapi/types/project-tasks',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'approve', 'post', 'import', 'export'],
    fields: [
      { key: 'projectId', label: 'Project ID', type: 'reference', referenceTo: 'project', required: true, filterable: true },
      { key: 'applicationNumber', label: 'Application Number', type: 'string', required: true, searchable: true, filterable: true, sortable: true },
      { key: 'amountRequested', label: 'Amount Requested', type: 'currency', required: true, filterable: true, sortable: true },
    ],
    events: ['payApplication.created', 'payApplication.approved', 'payApplication.posted'],
    customizable: true,
  }),
  standardRecord({
    key: 'saved_search',
    label: 'Saved Search',
    pluralLabel: 'Saved Searches',
    category: 'system',
    storage: 'table',
    tableName: 'saved_searches',
    apiPath: '/api/saved-searches',
    description: 'A user-defined ontology query that can power lists, reports, exports, dashboards, and APIs.',
    ownedByPackage: '@glapi/types/ontology',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'export'],
    fields: [
      { key: 'recordKey', label: 'Record Key', type: 'string', required: true, filterable: true },
      { key: 'visibility', label: 'Visibility', type: 'enum', enumValues: ['private', 'shared', 'system'], required: true, filterable: true },
      { key: 'definition', label: 'Definition', type: 'json', required: true },
    ],
    events: ['savedSearch.created', 'savedSearch.updated', 'savedSearch.deleted'],
    customizable: false,
  }),
  standardRecord({
    key: 'custom_field_definition',
    label: 'Custom Field Definition',
    pluralLabel: 'Custom Field Definitions',
    category: 'system',
    storage: 'table',
    tableName: 'custom_field_definitions',
    apiPath: '/api/custom-field-definitions',
    description: 'An organization-defined field attached to a standard or custom ontology record.',
    ownedByPackage: '@glapi/types/ontology',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    fields: [
      { key: 'recordKey', label: 'Record Key', type: 'string', required: true, filterable: true },
      { key: 'fieldKey', label: 'Field Key', type: 'string', required: true, searchable: true, filterable: true },
      { key: 'fieldType', label: 'Field Type', type: 'enum', required: true, enumValues: ontologyFieldTypeSchema.options, filterable: true },
      { key: 'validation', label: 'Validation', type: 'json' },
      { key: 'permissions', label: 'Permissions', type: 'json' },
    ],
    events: ['customFieldDefinition.created', 'customFieldDefinition.updated', 'customFieldDefinition.deleted'],
    customizable: false,
  }),
  standardRecord({
    key: 'custom_record_type',
    label: 'Custom Record Type',
    pluralLabel: 'Custom Record Types',
    category: 'system',
    storage: 'table',
    tableName: 'custom_record_types',
    apiPath: '/api/custom-record-types',
    description: 'An organization-defined record schema registered into the ontology.',
    ownedByPackage: '@glapi/types/ontology',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    fields: [
      { key: 'recordKey', label: 'Record Key', type: 'string', required: true, searchable: true, filterable: true },
      { key: 'baseRecordKey', label: 'Base Record Key', type: 'string', filterable: true },
      { key: 'definition', label: 'Definition', type: 'json', required: true },
    ],
    events: ['customRecordType.created', 'customRecordType.updated', 'customRecordType.deleted'],
    customizable: false,
  }),
  standardRecord({
    key: 'custom_record',
    label: 'Custom Record',
    pluralLabel: 'Custom Records',
    category: 'custom',
    storage: 'custom_record',
    tableName: 'custom_records',
    apiPath: '/api/custom-records',
    description: 'An instance of an organization-defined custom record type.',
    ownedByPackage: '@glapi/types/ontology',
    operations: ['create', 'read', 'update', 'delete', 'list', 'search', 'import', 'export'],
    fields: [
      { key: 'recordTypeId', label: 'Record Type ID', type: 'reference', referenceTo: 'custom_record_type', required: true, filterable: true },
      { key: 'recordKey', label: 'Record Key', type: 'string', required: true, filterable: true },
      { key: 'values', label: 'Values', type: 'json', required: true, searchable: true, filterable: true },
    ],
    relationships: [
      { key: 'custom_record_type', label: 'Custom Record Type', type: 'belongs_to', targetRecord: 'custom_record_type', sourceField: 'recordTypeId' },
    ],
    events: ['customRecord.created', 'customRecord.updated', 'customRecord.deleted'],
    customizable: true,
  }),
];

export const ONTOLOGY_REGISTRY: OntologyRegistry = ontologyRegistrySchema.parse({
  version: '2026.05',
  records: STANDARD_ONTOLOGY_RECORDS,
});

// ============================================================================
// Registry Helpers
// ============================================================================

export function assertOntologyRegistry(
  registry: OntologyRegistry = ONTOLOGY_REGISTRY,
): OntologyRegistry {
  return ontologyRegistrySchema.parse(registry);
}

export function getOntologyRecord(
  key: string,
  registry: OntologyRegistry = ONTOLOGY_REGISTRY,
): OntologyRecordDefinition | undefined {
  return registry.records.find((record) => record.key === key);
}

export function listOntologyRecords(
  options: {
    category?: OntologyRecordCategory;
    customizable?: boolean;
  } = {},
  registry: OntologyRegistry = ONTOLOGY_REGISTRY,
): OntologyRecordDefinition[] {
  return registry.records.filter((record) => {
    if (options.category && record.category !== options.category) {
      return false;
    }

    if (
      typeof options.customizable === 'boolean'
      && record.customizable !== options.customizable
    ) {
      return false;
    }

    return true;
  });
}

export function isOntologyRecordKey(value: string): value is OntologyRecordKey {
  return ontologyRecordKeySchema.safeParse(value).success;
}

export function isOntologyFieldKey(value: string): value is OntologyFieldKey {
  return ontologyFieldKeySchema.safeParse(value).success;
}
