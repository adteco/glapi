# TASK-012: Data Migration and Legacy System Integration

## Description
Create comprehensive data migration scripts and processes to migrate existing contract and revenue data from legacy systems into the new 606Ledger structure, ensuring data integrity and minimal downtime.

## Acceptance Criteria
- [ ] Migration scripts for existing contracts to subscriptions
- [ ] Revenue schedule migration from legacy calculations
- [ ] Data validation and integrity checks
- [ ] Rollback procedures for failed migrations
- [ ] Performance optimization for large datasets
- [ ] Audit trail of all migration activities
- [ ] Legacy data comparison and validation reports
- [ ] Zero-downtime migration strategy
- [ ] Migration testing with production data copies
- [ ] Documentation for migration procedures

## Dependencies
- TASK-001: Subscription database schema
- TASK-003: Revenue recognition schema
- TASK-011: Integration testing (for validation)

## Estimated Effort
4 days

## Technical Implementation

### Migration Strategy Overview
```typescript
// packages/database/src/migrations/data-migration/migration-strategy.ts

export interface MigrationPlan {
  phase: 'preparation' | 'migration' | 'validation' | 'cleanup';
  steps: MigrationStep[];
  rollbackProcedures: RollbackStep[];
  validationChecks: ValidationCheck[];
}

export interface MigrationStep {
  id: string;
  name: string;
  description: string;
  estimatedDuration: number; // minutes
  dependencies: string[];
  execute: () => Promise<MigrationResult>;
}

export class MigrationOrchestrator {
  constructor(
    private sourceDb: Database, // Legacy database
    private targetDb: Database, // New 606Ledger database
    private logger: MigrationLogger
  ) {}

  async executeMigrationPlan(plan: MigrationPlan): Promise<MigrationSummary> {
    const summary: MigrationSummary = {
      startTime: new Date(),
      totalSteps: plan.steps.length,
      completedSteps: 0,
      failedSteps: 0,
      warnings: [],
      errors: []
    };

    try {
      // Phase 1: Preparation
      await this.prepareForMigration();

      // Phase 2: Execute migration steps
      for (const step of plan.steps) {
        this.logger.info(`Starting migration step: ${step.name}`);
        
        try {
          const result = await step.execute();
          
          if (result.success) {
            summary.completedSteps++;
            this.logger.info(`Completed step: ${step.name} - ${result.recordsProcessed} records`);
          } else {
            summary.failedSteps++;
            summary.errors.push(`Step ${step.name} failed: ${result.error}`);
            
            if (result.critical) {
              throw new Error(`Critical migration step failed: ${step.name}`);
            }
          }
        } catch (error) {
          summary.failedSteps++;
          summary.errors.push(`Step ${step.name} error: ${error.message}`);
          
          // Execute rollback for this step
          await this.rollbackStep(step);
          throw error;
        }
      }

      // Phase 3: Validation
      const validationResults = await this.validateMigration(plan.validationChecks);
      summary.validationResults = validationResults;

      if (!validationResults.passed) {
        throw new Error('Migration validation failed');
      }

      summary.endTime = new Date();
      summary.success = true;

    } catch (error) {
      summary.endTime = new Date();
      summary.success = false;
      summary.errors.push(`Migration failed: ${error.message}`);
      
      // Execute full rollback
      await this.executeRollback(plan.rollbackProcedures);
    }

    return summary;
  }
}
```

### Contract to Subscription Migration
```typescript
// packages/database/src/migrations/data-migration/contracts-to-subscriptions.ts

export class ContractsToSubscriptionsMigration {
  constructor(private db: Database, private logger: MigrationLogger) {}

  async execute(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      recordsProcessed: 0,
      recordsSkipped: 0,
      errors: []
    };

    try {
      // Get all legacy contracts
      const legacyContracts = await this.getLegacyContracts();
      
      this.logger.info(`Found ${legacyContracts.length} legacy contracts to migrate`);

      for (const contract of legacyContracts) {
        try {
          await this.migrateContract(contract);
          result.recordsProcessed++;
        } catch (error) {
          result.recordsSkipped++;
          result.errors.push({
            contractId: contract.id,
            error: error.message
          });
          
          this.logger.warn(`Skipped contract ${contract.id}: ${error.message}`);
        }
      }

      result.success = result.recordsProcessed > 0;
      return result;

    } catch (error) {
      result.error = error.message;
      return result;
    }
  }

  private async migrateContract(legacyContract: LegacyContract): Promise<void> {
    await this.db.transaction(async (tx) => {
      // 1. Create subscription record
      const subscription = await this.createSubscriptionFromContract(tx, legacyContract);

      // 2. Migrate contract line items to subscription items
      await this.migrateContractLineItems(tx, legacyContract, subscription.id);

      // 3. Migrate existing performance obligations if any
      await this.migratePerformanceObligations(tx, legacyContract, subscription.id);

      // 4. Create initial revenue calculation
      await this.createInitialRevenueCalculation(tx, subscription.id);

      // 5. Create audit trail
      await this.createMigrationAuditRecord(tx, {
        legacyContractId: legacyContract.id,
        newSubscriptionId: subscription.id,
        migrationType: 'contract_to_subscription',
        migrationDate: new Date()
      });
    });
  }

  private async createSubscriptionFromContract(
    tx: DatabaseTransaction,
    contract: LegacyContract
  ): Promise<Subscription> {
    // Map legacy contract status to subscription status
    const statusMapping: { [key: string]: string } = {
      'signed': 'active',
      'active': 'active',
      'terminated': 'cancelled',
      'expired': 'cancelled',
      'draft': 'draft'
    };

    const [subscription] = await tx
      .insert(subscriptions)
      .values({
        organizationId: contract.organizationId,
        subscriptionNumber: contract.contractNumber,
        entityId: contract.customerId,
        status: statusMapping[contract.status] || 'draft',
        startDate: contract.effectiveDate,
        endDate: contract.endDate,
        contractValue: contract.contractValue,
        billingFrequency: this.mapBillingFrequency(contract.billingTerms),
        autoRenew: contract.autoRenewal || false,
        metadata: {
          migratedFrom: 'legacy_contract',
          originalContractId: contract.id,
          migrationDate: new Date().toISOString()
        }
      })
      .returning();

    return subscription;
  }

  private async migrateContractLineItems(
    tx: DatabaseTransaction,
    contract: LegacyContract,
    subscriptionId: string
  ): Promise<void> {
    const lineItems = await this.getLegacyContractLineItems(contract.id);

    for (const lineItem of lineItems) {
      // Find matching item in new system or create mapping
      const itemId = await this.findOrCreateItemMapping(tx, lineItem.productId, contract.organizationId);

      await tx
        .insert(subscriptionItems)
        .values({
          subscriptionId,
          itemId,
          quantity: lineItem.quantity,
          unitPrice: lineItem.unitPrice,
          discountPercentage: lineItem.discountPercentage || 0,
          startDate: lineItem.startDate || contract.effectiveDate,
          endDate: lineItem.endDate || contract.endDate,
          metadata: {
            migratedFrom: 'legacy_contract_line_item',
            originalLineItemId: lineItem.id
          }
        });
    }
  }

  private async migratePerformanceObligations(
    tx: DatabaseTransaction,
    contract: LegacyContract,
    subscriptionId: string
  ): Promise<void> {
    // Check if legacy system had performance obligations
    const legacyObligations = await this.getLegacyPerformanceObligations(contract.id);

    if (legacyObligations.length === 0) {
      // No existing obligations - they'll be created by revenue calculation
      return;
    }

    for (const legacyObligation of legacyObligations) {
      const itemId = await this.findItemMapping(legacyObligation.productId, contract.organizationId);

      await tx
        .insert(performanceObligations)
        .values({
          organizationId: contract.organizationId,
          subscriptionId,
          itemId,
          obligationType: this.mapObligationType(legacyObligation.type),
          allocatedAmount: legacyObligation.allocatedAmount,
          satisfactionMethod: this.mapSatisfactionMethod(legacyObligation.satisfactionMethod),
          startDate: legacyObligation.startDate,
          endDate: legacyObligation.endDate,
          status: 'active'
        });
    }
  }
}
```

### Revenue Schedule Migration
```typescript
// packages/database/src/migrations/data-migration/revenue-schedules.ts

export class RevenueScheduleMigration {
  async migrateRevenueSchedules(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      recordsProcessed: 0,
      recordsSkipped: 0,
      errors: []
    };

    try {
      // Get all legacy revenue schedules
      const legacySchedules = await this.getLegacyRevenueSchedules();

      for (const schedule of legacySchedules) {
        try {
          await this.migrateRevenueSchedule(schedule);
          result.recordsProcessed++;
        } catch (error) {
          result.recordsSkipped++;
          result.errors.push({
            scheduleId: schedule.id,
            error: error.message
          });
        }
      }

      result.success = true;
      return result;

    } catch (error) {
      result.error = error.message;
      return result;
    }
  }

  private async migrateRevenueSchedule(legacySchedule: LegacyRevenueSchedule): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Find corresponding performance obligation
      const performanceObligation = await this.findPerformanceObligation(
        tx,
        legacySchedule.contractId,
        legacySchedule.productId
      );

      if (!performanceObligation) {
        throw new Error(`No performance obligation found for legacy schedule ${legacySchedule.id}`);
      }

      // Create new revenue schedule
      await tx
        .insert(revenueSchedules)
        .values({
          organizationId: legacySchedule.organizationId,
          performanceObligationId: performanceObligation.id,
          periodStartDate: legacySchedule.periodStartDate,
          periodEndDate: legacySchedule.periodEndDate,
          scheduledAmount: legacySchedule.scheduledAmount,
          recognizedAmount: legacySchedule.recognizedAmount,
          recognitionDate: legacySchedule.recognitionDate,
          recognitionPattern: this.mapRecognitionPattern(legacySchedule.pattern),
          status: legacySchedule.status === 'recognized' ? 'recognized' : 'scheduled'
        });

      // If revenue was already recognized, create journal entries
      if (legacySchedule.recognitionDate && legacySchedule.recognizedAmount > 0) {
        await this.createJournalEntryFromLegacyRecognition(tx, legacySchedule, performanceObligation.id);
      }
    });
  }
}
```

### Data Validation and Integrity Checks
```typescript
// packages/database/src/migrations/data-migration/validation.ts

export class MigrationValidator {
  async validateMigration(checks: ValidationCheck[]): Promise<ValidationResult> {
    const result: ValidationResult = {
      passed: true,
      totalChecks: checks.length,
      passedChecks: 0,
      failedChecks: 0,
      warnings: [],
      errors: []
    };

    for (const check of checks) {
      try {
        const checkResult = await this.executeValidationCheck(check);
        
        if (checkResult.passed) {
          result.passedChecks++;
        } else {
          result.failedChecks++;
          result.errors.push({
            checkName: check.name,
            error: checkResult.error,
            details: checkResult.details
          });
        }

        if (checkResult.warnings) {
          result.warnings.push(...checkResult.warnings.map(w => ({ checkName: check.name, warning: w })));
        }

      } catch (error) {
        result.failedChecks++;
        result.errors.push({
          checkName: check.name,
          error: error.message
        });
      }
    }

    result.passed = result.failedChecks === 0;
    return result;
  }

  // Data consistency checks
  async validateContractMigration(): Promise<ValidationCheckResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check 1: All contracts migrated
    const legacyContractCount = await this.countLegacyContracts();
    const migratedSubscriptionCount = await this.countMigratedSubscriptions();

    if (legacyContractCount !== migratedSubscriptionCount) {
      errors.push(`Contract count mismatch: ${legacyContractCount} legacy contracts vs ${migratedSubscriptionCount} subscriptions`);
    }

    // Check 2: Contract values match
    const legacyTotalValue = await this.sumLegacyContractValues();
    const subscriptionTotalValue = await this.sumSubscriptionValues();

    if (Math.abs(legacyTotalValue - subscriptionTotalValue) > 0.01) {
      errors.push(`Total contract value mismatch: ${legacyTotalValue} vs ${subscriptionTotalValue}`);
    }

    // Check 3: Line item integrity
    const orphanedLineItems = await this.findOrphanedSubscriptionItems();
    if (orphanedLineItems.length > 0) {
      errors.push(`Found ${orphanedLineItems.length} subscription items without valid subscriptions`);
    }

    // Check 4: Revenue schedule completeness
    const missingSschedules = await this.findSubscriptionsWithoutSchedules();
    if (missingSschedules.length > 0) {
      warnings.push(`${missingSschedules.length} subscriptions don't have revenue schedules yet`);
    }

    return {
      passed: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : null,
      warnings: warnings.length > 0 ? warnings : null
    };
  }

  async validateRevenueScheduleMigration(): Promise<ValidationCheckResult> {
    const errors: string[] = [];

    // Validate total scheduled amounts match contract values
    const subscriptionRevenueTotals = await this.getSubscriptionRevenueTotals();
    
    for (const total of subscriptionRevenueTotals) {
      const subscription = await this.getSubscription(total.subscriptionId);
      
      if (Math.abs(total.totalScheduled - subscription.contractValue) > 0.01) {
        errors.push(
          `Subscription ${subscription.subscriptionNumber}: scheduled revenue ${total.totalScheduled} != contract value ${subscription.contractValue}`
        );
      }
    }

    // Validate no duplicate schedules
    const duplicateSchedules = await this.findDuplicateRevenueSchedules();
    if (duplicateSchedules.length > 0) {
      errors.push(`Found ${duplicateSchedules.length} duplicate revenue schedules`);
    }

    return {
      passed: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : null
    };
  }
}
```

### Migration Rollback Procedures
```typescript
// packages/database/src/migrations/data-migration/rollback.ts

export class MigrationRollback {
  async executeRollback(steps: RollbackStep[]): Promise<RollbackResult> {
    const result: RollbackResult = {
      success: false,
      stepsExecuted: 0,
      errors: []
    };

    try {
      // Execute rollback steps in reverse order
      for (const step of steps.reverse()) {
        await step.execute();
        result.stepsExecuted++;
      }

      result.success = true;
      return result;

    } catch (error) {
      result.errors.push(error.message);
      return result;
    }
  }

  async rollbackContractMigration(): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Delete migrated data in dependency order
      await tx.delete(revenueJournalEntries).where(
        exists(
          tx.select().from(revenueSchedules)
            .where(eq(revenueSchedules.id, revenueJournalEntries.revenueScheduleId))
            .where(sql`metadata->>'migratedFrom' = 'legacy_revenue_schedule'`)
        )
      );

      await tx.delete(revenueSchedules).where(
        sql`metadata->>'migratedFrom' = 'legacy_revenue_schedule'`
      );

      await tx.delete(performanceObligations).where(
        exists(
          tx.select().from(subscriptions)
            .where(eq(subscriptions.id, performanceObligations.subscriptionId))
            .where(sql`metadata->>'migratedFrom' = 'legacy_contract'`)
        )
      );

      await tx.delete(subscriptionItems).where(
        exists(
          tx.select().from(subscriptions)
            .where(eq(subscriptions.id, subscriptionItems.subscriptionId))
            .where(sql`metadata->>'migratedFrom' = 'legacy_contract'`)
        )
      );

      await tx.delete(subscriptions).where(
        sql`metadata->>'migratedFrom' = 'legacy_contract'`
      );

      // Delete migration audit records
      await tx.delete(migrationAuditLog).where(
        eq(migrationAuditLog.migrationType, 'contract_to_subscription')
      );
    });
  }
}
```

### Test Requirements

#### Migration Tests
```typescript
describe('Data Migration', () => {
  it('should migrate all contracts to subscriptions correctly', async () => {
    // Create test legacy data
    const legacyContracts = await setupLegacyContractData();
    
    // Execute migration
    const migrator = new ContractsToSubscriptionsMigration(db, logger);
    const result = await migrator.execute();
    
    // Validate results
    expect(result.success).toBe(true);
    expect(result.recordsProcessed).toBe(legacyContracts.length);
    
    // Validate data integrity
    const validator = new MigrationValidator();
    const validationResult = await validator.validateContractMigration();
    expect(validationResult.passed).toBe(true);
  });

  it('should handle rollback correctly on migration failure', async () => {
    // Setup data that will cause migration to fail
    await setupInvalidLegacyData();
    
    const orchestrator = new MigrationOrchestrator(sourceDb, targetDb, logger);
    const result = await orchestrator.executeMigrationPlan(migrationPlan);
    
    expect(result.success).toBe(false);
    
    // Verify rollback occurred
    const subscriptionCount = await countSubscriptions();
    expect(subscriptionCount).toBe(0);
  });
});
```

### Files to Create
- `packages/database/src/migrations/data-migration/migration-orchestrator.ts`
- `packages/database/src/migrations/data-migration/contracts-to-subscriptions.ts`
- `packages/database/src/migrations/data-migration/revenue-schedules.ts`
- `packages/database/src/migrations/data-migration/validation.ts`
- `packages/database/src/migrations/data-migration/rollback.ts`
- `packages/database/src/migrations/data-migration/__tests__/migration.test.ts`
- `packages/database/src/migrations/data-migration/types.ts`
- `scripts/run-migration.ts`
- `docs/migration-runbook.md`

### Definition of Done
- [ ] All legacy contracts successfully migrated to subscriptions
- [ ] Revenue schedules migrated with data integrity maintained
- [ ] Validation checks confirm data accuracy
- [ ] Rollback procedures tested and functional
- [ ] Performance acceptable for production data volumes
- [ ] Audit trail maintained for all migrations
- [ ] Migration runbook documented
- [ ] Zero data loss during migration process
- [ ] Legacy system comparison reports generated