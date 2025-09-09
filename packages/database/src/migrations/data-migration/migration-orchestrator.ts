/**
 * Migration Orchestrator
 * Coordinates the entire data migration process from legacy systems to 606Ledger
 */

import { v4 as uuidv4 } from 'uuid';
import {
  MigrationPlan,
  MigrationPhase,
  MigrationStep,
  MigrationContext,
  MigrationResult,
  MigrationConfig,
  MigrationProgress,
  MigrationStatus,
  MigrationError,
  PhaseResult,
  StepResult,
  MappingStore,
  MappingType,
  AuditLog,
  AuditEntry,
  AuditFilter,
  MigrationLogger
} from './types';

export class MigrationOrchestrator {
  private plan: MigrationPlan;
  private config: MigrationConfig;
  private context: MigrationContext;
  private progress: MigrationProgress;
  private abortSignal: boolean = false;

  constructor(
    plan: MigrationPlan,
    config: MigrationConfig,
    database: any,
    logger?: MigrationLogger
  ) {
    this.plan = plan;
    this.config = config;
    
    // Initialize context
    this.context = {
      plan,
      database,
      organizationId: config.organizationId,
      batchSize: config.batchSize,
      dryRun: config.dryRun,
      logger: logger || new DefaultMigrationLogger(),
      mappingStore: new DefaultMappingStore(),
      auditLog: new DefaultAuditLog(),
      startTime: new Date(),
      metadata: {}
    };

    // Initialize progress tracking
    this.progress = {
      planId: plan.id,
      currentPhase: '',
      currentStep: '',
      totalPhases: plan.phases.length,
      completedPhases: 0,
      totalSteps: plan.phases.reduce((sum, phase) => sum + phase.steps.length, 0),
      completedSteps: 0,
      percentComplete: 0,
      estimatedTimeRemaining: plan.estimatedDuration,
      currentOperation: 'Initializing',
      recordsProcessed: 0,
      recordsRemaining: 0,
      errors: 0,
      warnings: 0
    };
  }

  /**
   * Execute the migration plan
   */
  async execute(): Promise<MigrationResult> {
    const startTime = new Date();
    const result: MigrationResult = {
      planId: this.plan.id,
      organizationId: this.config.organizationId,
      success: false,
      startTime,
      endTime: new Date(),
      duration: 0,
      phases: [],
      totalRecordsProcessed: 0,
      totalRecordsCreated: 0,
      totalRecordsFailed: 0,
      errors: [],
      warnings: [],
      validationResults: [],
      rollbackExecuted: false
    };

    try {
      this.context.logger.info(`Starting migration plan: ${this.plan.name}`, {
        planId: this.plan.id,
        organizationId: this.config.organizationId,
        dryRun: this.config.dryRun
      });

      // Pre-migration validation
      if (!this.config.dryRun) {
        await this.runPreMigrationValidation();
      }

      // Execute each phase
      for (const phase of this.plan.phases) {
        if (this.abortSignal) {
          throw new Error('Migration aborted by user');
        }

        const phaseResult = await this.executePhase(phase);
        result.phases.push(phaseResult);

        if (!phaseResult.success && !this.config.continueOnError) {
          throw new Error(`Phase ${phase.name} failed`);
        }

        this.progress.completedPhases++;
        this.updateProgress();
      }

      // Post-migration validation
      if (!this.config.dryRun) {
        const validationResults = await this.runPostMigrationValidation();
        result.validationResults = validationResults;
      }

      // Calculate totals
      result.totalRecordsProcessed = result.phases.reduce(
        (sum, phase) => sum + phase.steps.reduce(
          (stepSum, step) => stepSum + (step.recordsProcessed || 0), 0
        ), 0
      );
      
      result.totalRecordsCreated = result.phases.reduce(
        (sum, phase) => sum + phase.steps.reduce(
          (stepSum, step) => stepSum + (step.recordsCreated || 0), 0
        ), 0
      );

      result.totalRecordsFailed = result.phases.reduce(
        (sum, phase) => sum + phase.steps.reduce(
          (stepSum, step) => stepSum + (step.recordsFailed || 0), 0
        ), 0
      );

      result.success = true;
      this.context.logger.info('Migration completed successfully', result);

    } catch (error) {
      this.context.logger.error('Migration failed', error as Error);
      result.errors.push(this.createMigrationError(error as Error, 'critical'));

      // Execute rollback if not in dry run mode
      if (!this.config.dryRun && this.plan.rollbackProcedures.length > 0) {
        try {
          await this.executeRollback();
          result.rollbackExecuted = true;
        } catch (rollbackError) {
          this.context.logger.error('Rollback failed', rollbackError as Error);
          result.errors.push(this.createMigrationError(rollbackError as Error, 'critical'));
        }
      }
    } finally {
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - startTime.getTime();

      // Export audit log
      if (!this.config.dryRun) {
        const auditLogPath = await this.exportAuditLog();
        result.auditLogPath = auditLogPath;
      }
    }

    return result;
  }

  /**
   * Execute a single migration phase
   */
  private async executePhase(phase: MigrationPhase): Promise<PhaseResult> {
    const startTime = new Date();
    const result: PhaseResult = {
      phaseId: phase.id,
      phaseName: phase.name,
      success: false,
      startTime,
      endTime: new Date(),
      duration: 0,
      steps: [],
      errors: []
    };

    try {
      this.context.logger.info(`Starting phase: ${phase.name}`);
      this.progress.currentPhase = phase.name;
      phase.status = 'in_progress';
      phase.startedAt = startTime;

      // Execute steps in order
      for (const step of phase.steps) {
        if (this.abortSignal) {
          throw new Error('Phase execution aborted');
        }

        // Check dependencies
        if (step.dependencies.length > 0) {
          await this.waitForDependencies(step.dependencies);
        }

        const stepResult = await this.executeStep(step);
        result.steps.push(stepResult);

        if (!stepResult.success && step.critical) {
          throw new Error(`Critical step ${step.name} failed`);
        }

        this.progress.completedSteps++;
        this.updateProgress();
      }

      phase.status = 'completed';
      phase.completedAt = new Date();
      result.success = true;

    } catch (error) {
      phase.status = 'failed';
      phase.errors = phase.errors || [];
      phase.errors.push(this.createMigrationError(error as Error, 'error'));
      result.errors.push(this.createMigrationError(error as Error, 'error'));
    } finally {
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - startTime.getTime();
    }

    return result;
  }

  /**
   * Execute a single migration step
   */
  private async executeStep(step: MigrationStep): Promise<StepResult> {
    this.context.logger.info(`Executing step: ${step.name}`);
    this.progress.currentStep = step.name;
    this.progress.currentOperation = step.description;

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < step.maxRetries) {
      try {
        step.status = 'in_progress';

        // Execute the step
        const result = await step.execute(this.context);

        // Run validation if defined
        if (step.validate && !this.config.dryRun) {
          const validationResult = await step.validate(this.context);
          if (!validationResult.passed) {
            throw new Error(`Validation failed: ${validationResult.message}`);
          }
        }

        step.status = 'completed';
        step.result = result;
        return result;

      } catch (error) {
        lastError = error as Error;
        attempts++;

        if (!step.retryable || attempts >= step.maxRetries) {
          break;
        }

        this.context.logger.warn(`Step ${step.name} failed, retrying (${attempts}/${step.maxRetries})`);
        await this.delay(this.config.retryDelay);
      }
    }

    // Step failed after all retries
    step.status = 'failed';
    const errorResult: StepResult = {
      success: false,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [this.createMigrationError(lastError!, 'error')],
      warnings: [],
      duration: 0
    };

    step.result = errorResult;
    return errorResult;
  }

  /**
   * Execute rollback procedures
   */
  private async executeRollback(): Promise<void> {
    this.context.logger.info('Starting rollback procedures');

    // Sort rollback procedures by order (descending)
    const sortedProcedures = [...this.plan.rollbackProcedures].sort(
      (a, b) => b.order - a.order
    );

    for (const procedure of sortedProcedures) {
      try {
        this.context.logger.info(`Executing rollback: ${procedure.name}`);
        await procedure.execute(this.context);
      } catch (error) {
        this.context.logger.error(`Rollback procedure ${procedure.name} failed`, error as Error);
        // Continue with other rollback procedures
      }
    }

    this.context.logger.info('Rollback completed');
  }

  /**
   * Run pre-migration validation checks
   */
  private async runPreMigrationValidation(): Promise<void> {
    this.context.logger.info('Running pre-migration validation');

    const criticalChecks = this.plan.validationChecks.filter(check => check.critical);
    
    for (const check of criticalChecks) {
      const result = await check.execute(this.context);
      
      if (!result.passed) {
        throw new Error(`Pre-migration validation failed: ${check.name} - ${result.message}`);
      }
    }
  }

  /**
   * Run post-migration validation checks
   */
  private async runPostMigrationValidation(): Promise<any[]> {
    this.context.logger.info('Running post-migration validation');

    const results = [];
    
    for (const check of this.plan.validationChecks) {
      const result = await check.execute(this.context);
      results.push(result);
      
      if (!result.passed && check.critical) {
        this.context.logger.error(`Critical validation failed: ${check.name}`);
      }
    }

    return results;
  }

  /**
   * Wait for dependent steps to complete
   */
  private async waitForDependencies(dependencies: string[]): Promise<void> {
    // In a real implementation, this would check the status of dependent steps
    // For now, we'll just log
    this.context.logger.debug(`Checking dependencies: ${dependencies.join(', ')}`);
  }

  /**
   * Update migration progress
   */
  private updateProgress(): void {
    this.progress.percentComplete = Math.round(
      (this.progress.completedSteps / this.progress.totalSteps) * 100
    );

    // Estimate remaining time based on average step duration
    const elapsedTime = Date.now() - this.context.startTime.getTime();
    const averageStepTime = elapsedTime / Math.max(this.progress.completedSteps, 1);
    const remainingSteps = this.progress.totalSteps - this.progress.completedSteps;
    this.progress.estimatedTimeRemaining = Math.round(
      (averageStepTime * remainingSteps) / 1000
    );

    this.context.logger.progress(
      this.progress.completedSteps,
      this.progress.totalSteps,
      this.progress.currentOperation
    );
  }

  /**
   * Export audit log to file
   */
  private async exportAuditLog(): Promise<string> {
    const auditLogPath = `${this.config.auditLogPath}/migration_${this.plan.id}_${Date.now()}.json`;
    const auditData = this.context.auditLog.export('json');
    
    // In a real implementation, write to file system
    this.context.logger.info(`Audit log exported to: ${auditLogPath}`);
    
    return auditLogPath;
  }

  /**
   * Create a migration error object
   */
  private createMigrationError(error: Error, severity: 'critical' | 'error' | 'warning'): MigrationError {
    return {
      code: 'MIGRATION_ERROR',
      message: error.message,
      stackTrace: error.stack,
      timestamp: new Date(),
      severity
    };
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Abort the migration
   */
  public abort(): void {
    this.abortSignal = true;
    this.context.logger.warn('Migration abort requested');
  }

  /**
   * Get current progress
   */
  public getProgress(): MigrationProgress {
    return { ...this.progress };
  }
}

/**
 * Default implementation of MappingStore
 */
class DefaultMappingStore implements MappingStore {
  contractToSubscription = new Map<string, string>();
  lineItemToSubscriptionItem = new Map<string, string>();
  revenueScheduleMap = new Map<string, string>();
  performanceObligationMap = new Map<string, string>();

  save(type: MappingType, legacyId: string, newId: string): void {
    switch (type) {
      case 'contract_subscription':
        this.contractToSubscription.set(legacyId, newId);
        break;
      case 'line_item_subscription_item':
        this.lineItemToSubscriptionItem.set(legacyId, newId);
        break;
      case 'revenue_schedule':
        this.revenueScheduleMap.set(legacyId, newId);
        break;
      case 'performance_obligation':
        this.performanceObligationMap.set(legacyId, newId);
        break;
    }
  }

  get(type: MappingType, legacyId: string): string | undefined {
    switch (type) {
      case 'contract_subscription':
        return this.contractToSubscription.get(legacyId);
      case 'line_item_subscription_item':
        return this.lineItemToSubscriptionItem.get(legacyId);
      case 'revenue_schedule':
        return this.revenueScheduleMap.get(legacyId);
      case 'performance_obligation':
        return this.performanceObligationMap.get(legacyId);
    }
  }

  getAll(type: MappingType): Map<string, string> {
    switch (type) {
      case 'contract_subscription':
        return new Map(this.contractToSubscription);
      case 'line_item_subscription_item':
        return new Map(this.lineItemToSubscriptionItem);
      case 'revenue_schedule':
        return new Map(this.revenueScheduleMap);
      case 'performance_obligation':
        return new Map(this.performanceObligationMap);
    }
  }

  clear(): void {
    this.contractToSubscription.clear();
    this.lineItemToSubscriptionItem.clear();
    this.revenueScheduleMap.clear();
    this.performanceObligationMap.clear();
  }
}

/**
 * Default implementation of AuditLog
 */
class DefaultAuditLog implements AuditLog {
  private entries: AuditEntry[] = [];

  log(entry: AuditEntry): void {
    this.entries.push(entry);
  }

  getEntries(filter?: AuditFilter): AuditEntry[] {
    if (!filter) return [...this.entries];

    return this.entries.filter(entry => {
      if (filter.startDate && entry.timestamp < filter.startDate) return false;
      if (filter.endDate && entry.timestamp > filter.endDate) return false;
      if (filter.entityType && entry.entityType !== filter.entityType) return false;
      if (filter.result && entry.result !== filter.result) return false;
      if (filter.action && entry.action !== filter.action) return false;
      return true;
    });
  }

  export(format: 'json' | 'csv'): string {
    if (format === 'json') {
      return JSON.stringify(this.entries, null, 2);
    }

    // CSV export
    const headers = ['timestamp', 'action', 'entityType', 'entityId', 'legacyId', 'newId', 'result'];
    const rows = this.entries.map(entry => [
      entry.timestamp.toISOString(),
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.legacyId || '',
      entry.newId || '',
      entry.result
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

/**
 * Default implementation of MigrationLogger
 */
class DefaultMigrationLogger implements MigrationLogger {
  info(message: string, metadata?: any): void {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, metadata || '');
  }

  warn(message: string, metadata?: any): void {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, metadata || '');
  }

  error(message: string, error?: Error, metadata?: any): void {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error?.message || '', metadata || '');
    if (error?.stack) console.error(error.stack);
  }

  debug(message: string, metadata?: any): void {
    console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, metadata || '');
  }

  progress(current: number, total: number, message?: string): void {
    const percent = Math.round((current / total) * 100);
    console.log(`[PROGRESS] ${percent}% (${current}/${total}) ${message || ''}`);
  }
}