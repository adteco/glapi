/**
 * Data Migration Types and Interfaces
 * Defines the structure for legacy system data migration to 606Ledger
 */

export interface MigrationPlan {
  id: string;
  name: string;
  description: string;
  version: string;
  organizationId: string;
  phases: MigrationPhase[];
  rollbackProcedures: RollbackProcedure[];
  validationChecks: ValidationCheck[];
  estimatedDuration: number; // in seconds
  createdAt: Date;
  executedAt?: Date;
  completedAt?: Date;
  status: MigrationStatus;
}

export interface MigrationPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  steps: MigrationStep[];
  status: MigrationStatus;
  startedAt?: Date;
  completedAt?: Date;
  errors?: MigrationError[];
}

export interface MigrationStep {
  id: string;
  name: string;
  description: string;
  order: number;
  type: MigrationStepType;
  dependencies: string[]; // Step IDs that must complete first
  execute: (context: MigrationContext) => Promise<StepResult>;
  validate?: (context: MigrationContext) => Promise<ValidationResult>;
  rollback?: (context: MigrationContext) => Promise<void>;
  estimatedDuration: number; // in seconds
  critical: boolean; // If true, failure stops entire migration
  retryable: boolean;
  maxRetries: number;
  status: MigrationStatus;
  result?: StepResult;
}

export type MigrationStepType = 
  | 'data_extraction'
  | 'data_transformation'
  | 'data_loading'
  | 'validation'
  | 'cleanup';

export type MigrationStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'rolled_back'
  | 'skipped';

export interface MigrationContext {
  plan: MigrationPlan;
  database: any; // Drizzle database instance
  organizationId: string;
  batchSize: number;
  dryRun: boolean;
  logger: MigrationLogger;
  mappingStore: MappingStore;
  auditLog: AuditLog;
  startTime: Date;
  metadata: Record<string, any>;
}

export interface StepResult {
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errors: MigrationError[];
  warnings: string[];
  duration: number; // in milliseconds
  metadata?: Record<string, any>;
}

export interface MigrationError {
  code: string;
  message: string;
  details?: any;
  recordId?: string;
  stackTrace?: string;
  timestamp: Date;
  severity: 'critical' | 'error' | 'warning';
}

export interface ValidationCheck {
  id: string;
  name: string;
  description: string;
  type: ValidationType;
  execute: (context: MigrationContext) => Promise<ValidationResult>;
  critical: boolean;
}

export type ValidationType = 
  | 'record_count'
  | 'data_integrity'
  | 'value_reconciliation'
  | 'duplicate_check'
  | 'foreign_key_check'
  | 'business_rule';

export interface ValidationResult {
  passed: boolean;
  checkName: string;
  expected?: any;
  actual?: any;
  discrepancies: ValidationDiscrepancy[];
  message: string;
}

export interface ValidationDiscrepancy {
  field: string;
  legacyValue: any;
  migratedValue: any;
  recordId: string;
  severity: 'critical' | 'error' | 'warning';
}

export interface RollbackProcedure {
  id: string;
  name: string;
  phaseId: string;
  stepId?: string;
  execute: (context: MigrationContext) => Promise<void>;
  order: number; // Rollback happens in reverse order
}

export interface MappingStore {
  // Maps legacy IDs to new IDs
  contractToSubscription: Map<string, string>;
  lineItemToSubscriptionItem: Map<string, string>;
  revenueScheduleMap: Map<string, string>;
  performanceObligationMap: Map<string, string>;
  
  // Store mapping for retrieval
  save(type: MappingType, legacyId: string, newId: string): void;
  get(type: MappingType, legacyId: string): string | undefined;
  getAll(type: MappingType): Map<string, string>;
  clear(): void;
}

export type MappingType = 
  | 'contract_subscription'
  | 'line_item_subscription_item'
  | 'revenue_schedule'
  | 'performance_obligation';

export interface AuditLog {
  log(entry: AuditEntry): void;
  getEntries(filter?: AuditFilter): AuditEntry[];
  export(format: 'json' | 'csv'): string;
}

export interface AuditEntry {
  timestamp: Date;
  action: string;
  entityType: string;
  entityId: string;
  legacyId?: string;
  newId?: string;
  userId?: string;
  details?: Record<string, any>;
  result: 'success' | 'failure' | 'skipped';
  errors?: string[];
}

export interface AuditFilter {
  startDate?: Date;
  endDate?: Date;
  entityType?: string;
  result?: 'success' | 'failure' | 'skipped';
  action?: string;
}

export interface MigrationLogger {
  info(message: string, metadata?: any): void;
  warn(message: string, metadata?: any): void;
  error(message: string, error?: Error, metadata?: any): void;
  debug(message: string, metadata?: any): void;
  progress(current: number, total: number, message?: string): void;
}

// Legacy System Interfaces
export interface LegacyContract {
  id: string;
  organizationId: string;
  customerId: string;
  contractNumber: string;
  contractDate: string;
  startDate: string;
  endDate: string;
  totalValue: number;
  status: 'draft' | 'signed' | 'active' | 'terminated' | 'expired';
  lineItems: LegacyLineItem[];
  billingFrequency?: string;
  paymentTerms?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface LegacyLineItem {
  id: string;
  contractId: string;
  itemId: string;
  itemNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  startDate?: string;
  endDate?: string;
  recognitionPattern?: string;
  metadata?: Record<string, any>;
}

export interface LegacyRevenueSchedule {
  id: string;
  contractId: string;
  lineItemId: string;
  periodStart: string;
  periodEnd: string;
  scheduledAmount: number;
  recognizedAmount: number;
  deferredAmount: number;
  recognitionDate?: string;
  status: 'scheduled' | 'recognized' | 'deferred';
  journalEntryId?: string;
  metadata?: Record<string, any>;
}

export interface LegacyJournalEntry {
  id: string;
  entryDate: string;
  contractId: string;
  lineItemId?: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  description: string;
  revenueScheduleId?: string;
  reversalOf?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

// Migration Result Types
export interface MigrationResult {
  planId: string;
  organizationId: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number; // in milliseconds
  phases: PhaseResult[];
  totalRecordsProcessed: number;
  totalRecordsCreated: number;
  totalRecordsFailed: number;
  errors: MigrationError[];
  warnings: string[];
  validationResults: ValidationResult[];
  rollbackExecuted: boolean;
  auditLogPath?: string;
}

export interface PhaseResult {
  phaseId: string;
  phaseName: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;
  steps: StepResult[];
  errors: MigrationError[];
}

// Migration Configuration
export interface MigrationConfig {
  organizationId: string;
  batchSize: number;
  maxRetries: number;
  retryDelay: number; // in milliseconds
  validationLevel: 'basic' | 'standard' | 'comprehensive';
  dryRun: boolean;
  parallel: boolean;
  parallelWorkers: number;
  continueOnError: boolean;
  auditLogPath: string;
  backupPath?: string;
  customMappings?: Record<string, any>;
}

// Progress Tracking
export interface MigrationProgress {
  planId: string;
  currentPhase: string;
  currentStep: string;
  totalPhases: number;
  completedPhases: number;
  totalSteps: number;
  completedSteps: number;
  percentComplete: number;
  estimatedTimeRemaining: number; // in seconds
  currentOperation: string;
  recordsProcessed: number;
  recordsRemaining: number;
  errors: number;
  warnings: number;
}

// Comparison Report Types
export interface ComparisonReport {
  organizationId: string;
  generatedAt: Date;
  legacySystemSummary: SystemSummary;
  migratedSystemSummary: SystemSummary;
  discrepancies: ComparisonDiscrepancy[];
  reconciliationStatus: 'matched' | 'discrepancies_found' | 'failed';
}

export interface SystemSummary {
  totalContracts: number;
  totalContractValue: number;
  totalLineItems: number;
  totalRevenueSchedules: number;
  recognizedRevenue: number;
  deferredRevenue: number;
  periodCovered: { start: Date; end: Date };
}

export interface ComparisonDiscrepancy {
  type: 'missing_record' | 'value_mismatch' | 'status_mismatch' | 'duplicate_record';
  entityType: string;
  legacyId: string;
  newId?: string;
  field?: string;
  legacyValue?: any;
  newValue?: any;
  impact: 'critical' | 'high' | 'medium' | 'low';
  suggestedAction?: string;
}