# TASK-014: GL Integration & Journal Entry Automation

## Description
Implement comprehensive General Ledger (GL) integration with automated journal entry creation, posting, and reversal capabilities. This includes GL account mapping, batch processing for period-end close, and full audit trail support for all revenue recognition journal entries.

## Acceptance Criteria
- [ ] GL account mapping configuration system
- [ ] Automated journal entry generation from revenue recognition
- [ ] Batch processing for period-end journal entries
- [ ] Journal entry reversal and correction workflows
- [ ] GL posting integration with external accounting systems
- [ ] Multi-entity and multi-currency support
- [ ] Audit trail for all journal entries
- [ ] Reconciliation reports between sub-ledger and GL
- [ ] Configurable posting rules and approval workflows
- [ ] Unit tests for all journal entry scenarios

## Dependencies
- TASK-003: Revenue recognition schema (for journal entries table)
- TASK-009: Revenue calculation engine
- TASK-010: Reporting engine

## Estimated Effort
4 days

## Technical Implementation

### GL Account Mapping Schema
```typescript
// packages/database/src/db/schema/gl-account-mappings.ts
import { pgTable, uuid, varchar, timestamp, jsonb, boolean, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { accounts } from "./accounts";

export const mappingTypeEnum = pgEnum("mapping_type", [
  "revenue_recognition",
  "deferred_revenue",
  "accounts_receivable",
  "cash",
  "discount",
  "tax"
]);

export const glAccountMappings = pgTable("gl_account_mappings", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  mappingType: mappingTypeEnum("mapping_type").notNull(),
  
  // Mapping criteria
  itemId: uuid("item_id").references(() => items.id),
  itemCategoryId: uuid("item_category_id").references(() => itemCategories.id),
  subsidiaryId: uuid("subsidiary_id").references(() => subsidiaries.id),
  departmentId: uuid("department_id").references(() => departments.id),
  locationId: uuid("location_id").references(() => locations.id),
  classId: uuid("class_id").references(() => classes.id),
  
  // GL accounts
  debitAccountId: uuid("debit_account_id").references(() => accounts.id).notNull(),
  creditAccountId: uuid("credit_account_id").references(() => accounts.id).notNull(),
  
  // Additional rules
  rules: jsonb("rules"), // Complex mapping rules
  priority: integer("priority").default(0), // For rule precedence
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

// Journal entry batches for period-end processing
export const journalEntryBatches = pgTable("journal_entry_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  batchNumber: varchar("batch_number", { length: 50 }).notNull().unique(),
  batchType: varchar("batch_type", { length: 50 }).notNull(), // period_end, manual, reversal
  periodStartDate: date("period_start_date").notNull(),
  periodEndDate: date("period_end_date").notNull(),
  status: varchar("status", { length: 20 }).notNull(), // draft, approved, posted, reversed
  totalDebits: decimal("total_debits", { precision: 15, scale: 2 }).notNull(),
  totalCredits: decimal("total_credits", { precision: 15, scale: 2 }).notNull(),
  entryCount: integer("entry_count").notNull(),
  
  // Workflow
  preparedBy: uuid("prepared_by").references(() => users.id),
  preparedAt: timestamp("prepared_at", { withTimezone: true }),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  postedBy: uuid("posted_by").references(() => users.id),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  
  // External system integration
  externalSystemId: varchar("external_system_id", { length: 100 }),
  externalBatchId: varchar("external_batch_id", { length: 100 }),
  
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});
```

### Journal Entry Automation Service
```typescript
// packages/business/src/services/journal-entry-automation-service.ts
import { Database } from '@glapi/database';
import { 
  revenueSchedules, 
  revenueJournalEntries,
  glAccountMappings,
  journalEntryBatches,
  type RevenueSchedule,
  type GLAccountMapping
} from '@glapi/database/src/db/schema';

export interface JournalEntryLine {
  accountId: string;
  debitAmount: number;
  creditAmount: number;
  description: string;
  dimensions: {
    subsidiaryId?: string;
    departmentId?: string;
    locationId?: string;
    classId?: string;
    customerId?: string;
    itemId?: string;
  };
}

export interface JournalEntry {
  id?: string;
  entryDate: Date;
  entryType: 'revenue_recognition' | 'deferred_revenue' | 'reversal';
  referenceNumber: string;
  description: string;
  lines: JournalEntryLine[];
  sourceDocument: {
    type: 'revenue_schedule' | 'invoice' | 'payment';
    id: string;
  };
  status: 'draft' | 'approved' | 'posted' | 'reversed';
  reversalOf?: string;
}

export class JournalEntryAutomationService {
  constructor(
    private db: Database,
    private organizationId: string
  ) {}

  // Generate journal entries for revenue recognition
  async generateRevenueRecognitionEntries(
    periodEndDate: Date,
    options?: {
      scheduleIds?: string[];
      dryRun?: boolean;
      batchId?: string;
    }
  ): Promise<JournalEntry[]> {
    // Get schedules ready for recognition
    const schedulesToRecognize = await this.getSchedulesForRecognition(
      periodEndDate,
      options?.scheduleIds
    );

    const journalEntries: JournalEntry[] = [];
    
    for (const schedule of schedulesToRecognize) {
      // Get GL account mapping
      const mapping = await this.getGLMapping(schedule);
      
      if (!mapping) {
        throw new Error(`No GL mapping found for schedule ${schedule.id}`);
      }

      // Create journal entry
      const entry: JournalEntry = {
        entryDate: periodEndDate,
        entryType: 'revenue_recognition',
        referenceNumber: `REV-${schedule.id}-${periodEndDate.toISOString().split('T')[0]}`,
        description: `Revenue recognition for period ending ${periodEndDate.toISOString().split('T')[0]}`,
        lines: [
          {
            accountId: mapping.debitAccountId, // Deferred Revenue
            debitAmount: parseFloat(schedule.scheduledAmount),
            creditAmount: 0,
            description: 'Reduce deferred revenue',
            dimensions: await this.extractDimensions(schedule)
          },
          {
            accountId: mapping.creditAccountId, // Revenue
            debitAmount: 0,
            creditAmount: parseFloat(schedule.scheduledAmount),
            description: 'Recognize revenue',
            dimensions: await this.extractDimensions(schedule)
          }
        ],
        sourceDocument: {
          type: 'revenue_schedule',
          id: schedule.id
        },
        status: 'draft'
      };

      journalEntries.push(entry);

      if (!options?.dryRun) {
        // Save journal entry to database
        await this.saveJournalEntry(entry, schedule.id, options?.batchId);
        
        // Update schedule status
        await this.updateScheduleStatus(schedule.id, 'recognized', periodEndDate);
      }
    }

    return journalEntries;
  }

  // Batch processing for period-end close
  async processPeriodEndBatch(
    periodStartDate: Date,
    periodEndDate: Date,
    options?: {
      autoApprove?: boolean;
      autoPost?: boolean;
    }
  ): Promise<{
    batchId: string;
    entries: JournalEntry[];
    summary: {
      totalDebits: number;
      totalCredits: number;
      entryCount: number;
    };
  }> {
    // Create batch
    const batch = await this.createBatch({
      batchType: 'period_end',
      periodStartDate,
      periodEndDate,
      status: 'draft'
    });

    try {
      // Generate all journal entries for the period
      const entries = await this.generateRevenueRecognitionEntries(
        periodEndDate,
        { batchId: batch.id }
      );

      // Calculate totals
      const summary = this.calculateBatchSummary(entries);

      // Update batch with totals
      await this.updateBatch(batch.id, summary);

      // Auto-approve if requested
      if (options?.autoApprove) {
        await this.approveBatch(batch.id);
      }

      // Auto-post if requested
      if (options?.autoPost && options?.autoApprove) {
        await this.postBatchToGL(batch.id);
      }

      return {
        batchId: batch.id,
        entries,
        summary
      };
    } catch (error) {
      // Rollback batch on error
      await this.rollbackBatch(batch.id);
      throw error;
    }
  }

  // Reversal capabilities
  async reverseJournalEntry(
    originalEntryId: string,
    reversalDate: Date,
    reason: string
  ): Promise<JournalEntry> {
    const originalEntry = await this.getJournalEntry(originalEntryId);
    
    if (!originalEntry) {
      throw new Error(`Journal entry ${originalEntryId} not found`);
    }

    if (originalEntry.status === 'reversed') {
      throw new Error(`Journal entry ${originalEntryId} is already reversed`);
    }

    // Create reversal entry (swap debits and credits)
    const reversalEntry: JournalEntry = {
      entryDate: reversalDate,
      entryType: 'reversal',
      referenceNumber: `REV-${originalEntry.referenceNumber}`,
      description: `Reversal of ${originalEntry.referenceNumber}: ${reason}`,
      lines: originalEntry.lines.map(line => ({
        ...line,
        debitAmount: line.creditAmount,
        creditAmount: line.debitAmount,
        description: `Reversal: ${line.description}`
      })),
      sourceDocument: originalEntry.sourceDocument,
      status: 'draft',
      reversalOf: originalEntryId
    };

    // Save reversal entry
    const savedReversal = await this.saveJournalEntry(reversalEntry);

    // Mark original as reversed
    await this.markEntryAsReversed(originalEntryId, savedReversal.id);

    // Update revenue schedule if applicable
    if (originalEntry.sourceDocument.type === 'revenue_schedule') {
      await this.updateScheduleStatus(
        originalEntry.sourceDocument.id,
        'scheduled',
        null
      );
    }

    return savedReversal;
  }

  // GL account mapping logic
  async getGLMapping(schedule: RevenueSchedule): Promise<GLAccountMapping | null> {
    // Get performance obligation details for context
    const context = await this.getScheduleContext(schedule);

    // Find best matching GL mapping based on priority
    const mappings = await this.db
      .select()
      .from(glAccountMappings)
      .where(
        and(
          eq(glAccountMappings.organizationId, this.organizationId),
          eq(glAccountMappings.mappingType, 'revenue_recognition'),
          eq(glAccountMappings.isActive, true)
        )
      )
      .orderBy(desc(glAccountMappings.priority));

    // Apply mapping rules
    for (const mapping of mappings) {
      if (this.matchesMappingRules(mapping, context)) {
        return mapping;
      }
    }

    // Return default mapping if no specific match
    return mappings.find(m => !m.itemId && !m.itemCategoryId);
  }

  // External GL system integration
  async postBatchToGL(batchId: string): Promise<{
    success: boolean;
    externalBatchId?: string;
    errors?: string[];
  }> {
    const batch = await this.getBatch(batchId);
    const entries = await this.getBatchEntries(batchId);

    try {
      // Transform to external GL format
      const glPayload = this.transformToGLFormat(batch, entries);

      // Post to external GL system (implement based on your GL system)
      const response = await this.postToExternalGL(glPayload);

      if (response.success) {
        // Update batch with external reference
        await this.updateBatch(batchId, {
          status: 'posted',
          externalBatchId: response.batchId,
          postedAt: new Date()
        });

        return {
          success: true,
          externalBatchId: response.batchId
        };
      } else {
        return {
          success: false,
          errors: response.errors
        };
      }
    } catch (error) {
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  // Reconciliation between sub-ledger and GL
  async reconcileWithGL(
    periodStartDate: Date,
    periodEndDate: Date
  ): Promise<{
    matched: number;
    unmatched: number;
    discrepancies: Array<{
      type: string;
      subLedgerAmount: number;
      glAmount: number;
      difference: number;
      details: any;
    }>;
  }> {
    // Get sub-ledger totals
    const subLedgerTotals = await this.getSubLedgerTotals(periodStartDate, periodEndDate);

    // Get GL totals from external system
    const glTotals = await this.getGLTotals(periodStartDate, periodEndDate);

    // Compare and identify discrepancies
    const discrepancies = this.compareSubLedgerToGL(subLedgerTotals, glTotals);

    return {
      matched: discrepancies.filter(d => d.difference === 0).length,
      unmatched: discrepancies.filter(d => d.difference !== 0).length,
      discrepancies: discrepancies.filter(d => d.difference !== 0)
    };
  }

  // Helper methods
  private matchesMappingRules(mapping: GLAccountMapping, context: any): boolean {
    // Check direct matches
    if (mapping.itemId && mapping.itemId !== context.itemId) return false;
    if (mapping.itemCategoryId && mapping.itemCategoryId !== context.itemCategoryId) return false;
    if (mapping.subsidiaryId && mapping.subsidiaryId !== context.subsidiaryId) return false;
    if (mapping.departmentId && mapping.departmentId !== context.departmentId) return false;
    if (mapping.locationId && mapping.locationId !== context.locationId) return false;
    if (mapping.classId && mapping.classId !== context.classId) return false;

    // Check complex rules if defined
    if (mapping.rules) {
      return this.evaluateComplexRules(mapping.rules, context);
    }

    return true;
  }

  private evaluateComplexRules(rules: any, context: any): boolean {
    // Implement complex rule evaluation logic
    // e.g., amount thresholds, date ranges, custom conditions
    return true;
  }

  private async extractDimensions(schedule: RevenueSchedule): Promise<any> {
    // Extract accounting dimensions from the schedule context
    const context = await this.getScheduleContext(schedule);
    
    return {
      subsidiaryId: context.subsidiaryId,
      departmentId: context.departmentId,
      locationId: context.locationId,
      classId: context.classId,
      customerId: context.customerId,
      itemId: context.itemId
    };
  }
}
```

### Batch Processing Workflow
```typescript
// packages/business/src/services/period-end-processor.ts
export class PeriodEndProcessor {
  constructor(
    private journalService: JournalEntryAutomationService,
    private revenueService: RevenueService
  ) {}

  async runPeriodEndClose(
    period: { year: number; month: number },
    options?: {
      validateOnly?: boolean;
      autoApprove?: boolean;
      notifyUsers?: string[];
    }
  ): Promise<PeriodEndResult> {
    const periodStart = new Date(period.year, period.month - 1, 1);
    const periodEnd = new Date(period.year, period.month, 0);

    // Step 1: Validate readiness
    const validation = await this.validatePeriodReadiness(periodStart, periodEnd);
    
    if (!validation.isReady) {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings
      };
    }

    if (options?.validateOnly) {
      return {
        success: true,
        validation,
        preview: await this.previewPeriodEnd(periodStart, periodEnd)
      };
    }

    // Step 2: Lock period for processing
    await this.lockPeriod(periodStart, periodEnd);

    try {
      // Step 3: Generate journal entries
      const batch = await this.journalService.processPeriodEndBatch(
        periodStart,
        periodEnd,
        { autoApprove: options?.autoApprove }
      );

      // Step 4: Run reconciliation
      const reconciliation = await this.journalService.reconcileWithGL(
        periodStart,
        periodEnd
      );

      // Step 5: Generate reports
      const reports = await this.generatePeriodEndReports(periodStart, periodEnd);

      // Step 6: Notify users
      if (options?.notifyUsers) {
        await this.notifyUsers(options.notifyUsers, {
          period,
          batch,
          reconciliation,
          reports
        });
      }

      // Step 7: Unlock period
      await this.unlockPeriod(periodStart, periodEnd);

      return {
        success: true,
        batchId: batch.batchId,
        summary: batch.summary,
        reconciliation,
        reports
      };
    } catch (error) {
      // Rollback on error
      await this.unlockPeriod(periodStart, periodEnd);
      throw error;
    }
  }

  private async validatePeriodReadiness(
    periodStart: Date,
    periodEnd: Date
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for unrecognized schedules
    const unrecognizedCount = await this.countUnrecognizedSchedules(periodEnd);
    if (unrecognizedCount > 0) {
      warnings.push(`${unrecognizedCount} revenue schedules pending recognition`);
    }

    // Check for unapproved invoices
    const unapprovedInvoices = await this.countUnapprovedInvoices(periodEnd);
    if (unapprovedInvoices > 0) {
      errors.push(`${unapprovedInvoices} invoices require approval`);
    }

    // Check for unmatched payments
    const unmatchedPayments = await this.countUnmatchedPayments(periodEnd);
    if (unmatchedPayments > 0) {
      warnings.push(`${unmatchedPayments} payments not matched to invoices`);
    }

    // Check prior period status
    const priorPeriodClosed = await this.isPriorPeriodClosed(periodStart);
    if (!priorPeriodClosed) {
      errors.push('Prior period must be closed before processing current period');
    }

    return {
      isReady: errors.length === 0,
      errors,
      warnings
    };
  }
}
```

### Test Requirements
```typescript
describe('Journal Entry Automation Service', () => {
  describe('generateRevenueRecognitionEntries', () => {
    it('should create journal entries for all eligible schedules', async () => {
      // Test journal entry generation
    });

    it('should apply correct GL account mappings', async () => {
      // Test GL mapping logic
    });

    it('should handle multi-currency transactions', async () => {
      // Test currency conversion
    });
  });

  describe('processPeriodEndBatch', () => {
    it('should process all entries in batch', async () => {
      // Test batch processing
    });

    it('should rollback on error', async () => {
      // Test error handling and rollback
    });
  });

  describe('reverseJournalEntry', () => {
    it('should create reversal with swapped debits/credits', async () => {
      // Test reversal logic
    });

    it('should update original entry status', async () => {
      // Test status updates
    });
  });

  describe('reconcileWithGL', () => {
    it('should identify discrepancies between sub-ledger and GL', async () => {
      // Test reconciliation
    });
  });
});
```

### Files to Create
- `packages/database/src/db/schema/gl-account-mappings.ts`
- `packages/business/src/services/journal-entry-automation-service.ts`
- `packages/business/src/services/period-end-processor.ts`
- `packages/business/src/services/gl-integration-adapter.ts`
- `packages/api-service/src/services/journal-entry-service.ts`
- `packages/trpc/src/routers/journal-entries.ts`
- `packages/business/src/services/__tests__/journal-entry-automation.test.ts`

### Definition of Done
- [ ] GL account mapping configuration implemented
- [ ] Automated journal entry generation working
- [ ] Batch processing for period-end functional
- [ ] Reversal workflows tested and working
- [ ] External GL integration adapter created
- [ ] Reconciliation reports accurate
- [ ] Multi-entity and multi-currency support verified
- [ ] Audit trail complete for all entries
- [ ] Approval workflows configurable
- [ ] Unit tests passing with >90% coverage
- [ ] Performance tested with large batches
- [ ] Documentation complete