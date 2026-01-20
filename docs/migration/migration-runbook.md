# Data Migration Runbook

This runbook provides step-by-step guidance for migrating data into GLAPI from external accounting systems.

## Overview

The GLAPI migration toolkit supports importing data from:
- QuickBooks Online
- QuickBooks Desktop
- Xero
- Sage
- NetSuite
- Microsoft Dynamics
- FreshBooks
- Wave
- CSV/Excel files

### Supported Data Types

**Master Data:**
- Chart of Accounts
- Customers
- Vendors
- Employees
- Items/Products
- Departments
- Classes
- Locations
- Projects
- Cost Codes
- Subsidiaries

**Transactional Data:**
- Journal Entries
- Invoices
- Bills
- Payments
- Bill Payments
- Opening Balances
- Budgets
- Time Entries
- Expense Entries

## Pre-Migration Checklist

Before starting a migration, ensure:

- [ ] Source system data has been exported/accessible
- [ ] Target organization exists in GLAPI
- [ ] Chart of Accounts structure is defined
- [ ] Accounting periods are configured
- [ ] User has appropriate permissions (Admin or Migration role)
- [ ] Backup of existing GLAPI data (if any)

## Migration Process

### Step 1: Create Import Batch

Create a new import batch to track the migration:

```typescript
import { importService } from '@glapi/api-service';

const batch = await importService.createBatch({
  organizationId: 'org-123',
  name: 'QBO Migration - Chart of Accounts',
  description: 'Initial chart of accounts import from QuickBooks Online',
  sourceSystem: 'quickbooks_online',
  dataTypes: ['account'],
  userId: 'user-123',
  options: {
    skipDuplicates: true,
    enableRollback: true,
    continueOnErrors: false,
  },
});

console.log(`Created batch: ${batch.batchNumber}`);
```

### Step 2: Add Records

Add source records to the batch for processing:

```typescript
await importService.addRecords({
  batchId: batch.batchId,
  records: [
    {
      rowNumber: 1,
      externalId: 'qbo-1001',
      dataType: 'account',
      rawData: {
        AcctNum: '1000',
        Name: 'Cash',
        AccountType: 'Bank',
        Active: true,
      },
    },
    {
      rowNumber: 2,
      externalId: 'qbo-1002',
      dataType: 'account',
      rawData: {
        AcctNum: '1100',
        Name: 'Accounts Receivable',
        AccountType: 'Accounts Receivable',
        Active: true,
      },
    },
    // ... more records
  ],
});
```

### Step 3: Validate Records

Run validation to check data integrity before importing:

```typescript
const validationResult = await importService.validateBatch({
  batchId: batch.batchId,
});

console.log(`Validation complete:
  - Valid records: ${validationResult.validRecords}
  - Invalid records: ${validationResult.invalidRecords}
`);

// Review invalid records if any
if (validationResult.invalidRecords > 0) {
  const invalidRecords = await importService.getInvalidRecords(batch.batchId);
  for (const record of invalidRecords) {
    console.log(`Row ${record.rowNumber}: ${record.validationErrors}`);
  }
}
```

### Step 4: Execute Import

Once validation passes, execute the import:

```typescript
const importResult = await importService.executeImport({
  batchId: batch.batchId,
  options: {
    continueOnErrors: false, // Stop on first error
  },
});

console.log(`Import complete:
  - Imported: ${importResult.importedRecords}
  - Skipped: ${importResult.skippedRecords}
  - Failed: ${importResult.failedRecords}
`);
```

### Step 5: Verify Import

After import, verify the data:

```typescript
// Check batch status
const finalBatch = await importService.getBatch(batch.batchId);
console.log(`Final status: ${finalBatch.status}`);

// Review audit trail
const auditTrail = await importRollbackService.getAuditTrail(batch.batchId);
for (const entry of auditTrail) {
  console.log(`${entry.timestamp}: ${entry.action} by ${entry.userId}`);
}
```

## Rollback Procedures

### Validating Rollback Eligibility

Before rolling back, validate that rollback is possible:

```typescript
import { importRollbackService } from '@glapi/api-service';

const validation = await importRollbackService.validateRollback(batch.batchId);

if (!validation.canRollback) {
  console.log(`Cannot rollback: ${validation.reason}`);
  console.log('Blocking entities:', validation.dependentEntities);
} else {
  console.log(`Can rollback ${validation.recordCount} records`);
  if (validation.warnings.length > 0) {
    console.log('Warnings:', validation.warnings);
  }
}
```

### Performing Rollback

To rollback an import batch:

```typescript
// Dry run first to see what would happen
const dryRunResult = await importRollbackService.rollbackBatch(
  batch.batchId,
  'user-123',
  {
    dryRun: true,
    reason: 'Testing rollback before actual execution',
  }
);

console.log(`Dry run would rollback ${dryRunResult.rolledBackRecords} records`);

// Execute actual rollback
const rollbackResult = await importRollbackService.rollbackBatch(
  batch.batchId,
  'user-123',
  {
    reason: 'Data quality issues discovered post-import',
    continueOnErrors: false,
  }
);

if (rollbackResult.success) {
  console.log('Rollback completed successfully');
} else {
  console.log(`Rollback had ${rollbackResult.failedRecords} failures`);
  console.log('Errors:', rollbackResult.errors);
}
```

### Rolling Back Individual Records

To rollback a single record:

```typescript
const result = await importRollbackService.rollbackRecord(
  batch.batchId,
  'record-123',
  'user-123',
  'Incorrect data for this specific record'
);

if (result.success) {
  console.log(`Rolled back entity ${result.entityId}`);
} else {
  console.log(`Failed: ${result.error}`);
}
```

## Recommended Import Order

For best results, import data in this order:

1. **Master Data (in dependency order):**
   - Subsidiaries
   - Departments
   - Classes
   - Locations
   - Chart of Accounts
   - Customers
   - Vendors
   - Employees
   - Items/Products
   - Projects
   - Cost Codes

2. **Opening Balances:**
   - Opening balance journal entries
   - Customer opening balances
   - Vendor opening balances

3. **Transactional Data (chronological order):**
   - Historical journal entries
   - Invoices
   - Bills
   - Payments
   - Bill payments

## Validation Rules

### Account Validation

| Field | Rules |
|-------|-------|
| accountNumber | Required, alphanumeric, max 50 chars, unique |
| name | Required, max 255 chars |
| accountType | Required, must be valid type |
| normalBalance | Optional, must be 'debit' or 'credit' |

### Customer Validation

| Field | Rules |
|-------|-------|
| customerNumber | Required, alphanumeric, max 50 chars, unique |
| name | Required, max 255 chars |
| email | Optional, valid email format |
| creditLimit | Optional, must be non-negative |

### Vendor Validation

| Field | Rules |
|-------|-------|
| vendorNumber | Required, alphanumeric, max 50 chars, unique |
| name | Required, max 255 chars |
| email | Optional, valid email format |

### Item Validation

| Field | Rules |
|-------|-------|
| itemNumber | Required, alphanumeric, max 50 chars, unique |
| name | Required |
| itemType | Required, must be: inventory, non_inventory, service, other |
| unitPrice | Optional, must be non-negative |
| cost | Optional, must be non-negative |

## Error Handling

### Common Validation Errors

| Code | Description | Resolution |
|------|-------------|------------|
| REQUIRED | Field is required but missing | Add the required value |
| FORMAT | Field format is invalid | Fix format (e.g., date, email) |
| MAX_LENGTH | Field exceeds maximum length | Truncate or abbreviate |
| INVALID_VALUE | Field value not in allowed list | Use allowed value |
| DUPLICATE | Record already exists | Skip or update existing |

### Import Error Recovery

If import fails partway through:

1. Check the batch status and error summary
2. Fix the problematic records
3. Re-run validation
4. Execute import again (previously imported records will be skipped)

## Field Mapping

### QuickBooks Online Mapping

```typescript
// Account mapping
const qboAccountMapping = {
  'Id': 'externalId',
  'AcctNum': 'accountNumber',
  'Name': 'name',
  'AccountType': 'accountType',
  'Description': 'description',
  'Active': 'isActive',
};

// Customer mapping
const qboCustomerMapping = {
  'Id': 'externalId',
  'DisplayName': 'name',
  'PrimaryEmailAddr.Address': 'email',
  'PrimaryPhone.FreeFormNumber': 'phone',
  'BillAddr.Line1': 'address1',
  'BillAddr.City': 'city',
  'BillAddr.CountrySubDivisionCode': 'state',
  'BillAddr.PostalCode': 'postalCode',
};
```

### Xero Mapping

```typescript
// Account mapping
const xeroAccountMapping = {
  'AccountID': 'externalId',
  'Code': 'accountNumber',
  'Name': 'name',
  'Type': 'accountType',
  'Description': 'description',
  'Status': 'isActive',
};
```

### CSV Mapping

```typescript
// Generic CSV account mapping
const csvAccountMapping = {
  'Account Number': 'accountNumber',
  'Account Name': 'name',
  'Account Type': 'accountType',
  'Normal Balance': 'normalBalance',
  'Description': 'description',
  'Parent Account': 'parentAccountNumber',
  'Active': 'isActive',
};
```

## Audit Trail

All import operations are logged in the audit trail:

| Action | Description |
|--------|-------------|
| BATCH_CREATED | Import batch created |
| BATCH_VALIDATION_STARTED | Validation began |
| BATCH_VALIDATION_COMPLETED | Validation finished |
| BATCH_IMPORT_STARTED | Import began |
| BATCH_IMPORT_COMPLETED | Import finished |
| BATCH_FAILED | Import failed |
| BATCH_CANCELLED | Import cancelled by user |
| RECORD_IMPORTED | Individual record imported |
| ROLLBACK_STARTED | Rollback began |
| ROLLBACK_COMPLETED | Rollback finished |
| RECORD_ROLLED_BACK | Individual record rolled back |

## Monitoring Progress

Track import progress in real-time:

```typescript
const progress = await importService.getProgress(batch.batchId);

console.log(`
  Status: ${progress.status}
  Phase: ${progress.phase}
  Progress: ${progress.percentComplete}%
  Processed: ${progress.processedRecords}/${progress.totalRecords}
  Errors: ${progress.errors}
`);
```

## Best Practices

1. **Start with a small test batch** - Import a few records first to verify mappings
2. **Enable rollback** - Always enable rollback for initial migrations
3. **Validate before import** - Review validation errors before proceeding
4. **Import in order** - Follow the recommended import order for dependencies
5. **Document mappings** - Keep a record of field mappings used
6. **Backup existing data** - Always backup before major migrations
7. **Test in staging** - Test the full migration process in a staging environment
8. **Plan for errors** - Have a rollback strategy ready

## Troubleshooting

### Batch Stuck in Processing

If a batch is stuck in 'processing' status:
1. Check server logs for errors
2. Review the last few audit log entries
3. If safe, cancel the batch and start over

### Duplicate Records

If receiving duplicate errors:
1. Enable `skipDuplicates` option
2. Or use `updateExisting` to update matches
3. Review external IDs for uniqueness

### Performance Issues

For large imports:
1. Import in smaller batches (1000-5000 records)
2. Import during off-peak hours
3. Consider disabling non-critical validations

## Support

For migration assistance:
- Contact support with batch ID and error details
- Provide source system and data type being imported
- Include sample data (sanitized) if possible
