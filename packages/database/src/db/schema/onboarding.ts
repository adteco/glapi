/**
 * Onboarding State Schema
 *
 * Tracks onboarding progress per organization with:
 * - Step completion status
 * - Resume/skip functionality
 * - Progress persistence
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  text,
  integer,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

// =============================================================================
// Enums
// =============================================================================

/**
 * Onboarding step status
 */
export const onboardingStepStatusEnum = pgEnum('onboarding_step_status', [
  'not_started',
  'in_progress',
  'completed',
  'skipped',
]);

/**
 * Onboarding overall status
 */
export const onboardingStatusEnum = pgEnum('onboarding_status', [
  'not_started',
  'in_progress',
  'completed',
  'abandoned',
]);

// =============================================================================
// Tables
// =============================================================================

/**
 * Organization onboarding state
 * Tracks overall onboarding progress for an organization
 */
export const organizationOnboarding = pgTable('organization_onboarding', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id)
    .unique(),

  // Overall status
  status: onboardingStatusEnum('status').notNull().default('not_started'),

  // Current step (0-indexed)
  currentStep: integer('current_step').notNull().default(0),

  // Progress tracking
  totalSteps: integer('total_steps').notNull().default(5),
  completedSteps: integer('completed_steps').notNull().default(0),
  percentComplete: integer('percent_complete').notNull().default(0),

  // Timing
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  lastActivityAt: timestamp('last_activity_at'),

  // User tracking
  startedBy: varchar('started_by', { length: 255 }),
  completedBy: varchar('completed_by', { length: 255 }),

  // Metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Individual onboarding step progress
 */
export const onboardingSteps = pgTable('onboarding_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  onboardingId: uuid('onboarding_id')
    .notNull()
    .references(() => organizationOnboarding.id, { onDelete: 'cascade' }),

  // Step definition
  stepNumber: integer('step_number').notNull(),
  stepKey: varchar('step_key', { length: 100 }).notNull(),
  stepName: varchar('step_name', { length: 255 }).notNull(),
  description: text('description'),

  // Status
  status: onboardingStepStatusEnum('status').notNull().default('not_started'),
  isRequired: boolean('is_required').notNull().default(true),
  canSkip: boolean('can_skip').notNull().default(false),

  // Completion tracking
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  skippedAt: timestamp('skipped_at'),
  completedBy: varchar('completed_by', { length: 255 }),
  skippedBy: varchar('skipped_by', { length: 255 }),
  skipReason: text('skip_reason'),

  // Validation
  validationData: jsonb('validation_data').$type<Record<string, unknown>>(),
  isValid: boolean('is_valid'),
  validationErrors: jsonb('validation_errors').$type<string[]>(),

  // Step-specific data
  stepData: jsonb('step_data').$type<Record<string, unknown>>(),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Onboarding checklist items
 * Fine-grained tasks within each step
 */
export const onboardingChecklistItems = pgTable('onboarding_checklist_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  stepId: uuid('step_id')
    .notNull()
    .references(() => onboardingSteps.id, { onDelete: 'cascade' }),

  // Item definition
  itemKey: varchar('item_key', { length: 100 }).notNull(),
  itemName: varchar('item_name', { length: 255 }).notNull(),
  description: text('description'),
  helpUrl: varchar('help_url', { length: 500 }),

  // Status
  isCompleted: boolean('is_completed').notNull().default(false),
  isRequired: boolean('is_required').notNull().default(true),
  completedAt: timestamp('completed_at'),
  completedBy: varchar('completed_by', { length: 255 }),

  // Ordering
  sortOrder: integer('sort_order').notNull().default(0),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Onboarding events/audit log
 */
export const onboardingEvents = pgTable('onboarding_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  onboardingId: uuid('onboarding_id')
    .notNull()
    .references(() => organizationOnboarding.id, { onDelete: 'cascade' }),
  stepId: uuid('step_id').references(() => onboardingSteps.id, { onDelete: 'set null' }),

  // Event details
  eventType: varchar('event_type', { length: 100 }).notNull(),
  eventData: jsonb('event_data').$type<Record<string, unknown>>(),

  // User tracking
  userId: varchar('user_id', { length: 255 }),
  userEmail: varchar('user_email', { length: 255 }),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// =============================================================================
// Types
// =============================================================================

export type OrganizationOnboarding = typeof organizationOnboarding.$inferSelect;
export type NewOrganizationOnboarding = typeof organizationOnboarding.$inferInsert;
export type OnboardingStep = typeof onboardingSteps.$inferSelect;
export type NewOnboardingStep = typeof onboardingSteps.$inferInsert;
export type OnboardingChecklistItem = typeof onboardingChecklistItems.$inferSelect;
export type NewOnboardingChecklistItem = typeof onboardingChecklistItems.$inferInsert;
export type OnboardingEvent = typeof onboardingEvents.$inferSelect;
export type NewOnboardingEvent = typeof onboardingEvents.$inferInsert;

export type OnboardingStepStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';
export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'abandoned';

// =============================================================================
// Default Steps Configuration
// =============================================================================

export const DEFAULT_ONBOARDING_STEPS = [
  {
    stepNumber: 0,
    stepKey: 'welcome',
    stepName: 'Welcome',
    description: 'Get started with GLAPI',
    isRequired: true,
    canSkip: false,
    checklistItems: [
      { itemKey: 'view_intro', itemName: 'View introduction video', isRequired: false },
      { itemKey: 'accept_terms', itemName: 'Accept terms of service', isRequired: true },
    ],
  },
  {
    stepNumber: 1,
    stepKey: 'organization',
    stepName: 'Organization Setup',
    description: 'Configure your organization details',
    isRequired: true,
    canSkip: false,
    checklistItems: [
      { itemKey: 'org_name', itemName: 'Set organization name', isRequired: true },
      { itemKey: 'fiscal_year', itemName: 'Configure fiscal year', isRequired: true },
      { itemKey: 'base_currency', itemName: 'Set base currency', isRequired: true },
      { itemKey: 'timezone', itemName: 'Set timezone', isRequired: false },
    ],
  },
  {
    stepNumber: 2,
    stepKey: 'chart_of_accounts',
    stepName: 'Chart of Accounts',
    description: 'Set up your chart of accounts',
    isRequired: true,
    canSkip: true,
    checklistItems: [
      { itemKey: 'import_coa', itemName: 'Import or create chart of accounts', isRequired: true },
      { itemKey: 'review_accounts', itemName: 'Review account structure', isRequired: false },
    ],
  },
  {
    stepNumber: 3,
    stepKey: 'opening_balances',
    stepName: 'Opening Balances',
    description: 'Enter your opening balances',
    isRequired: false,
    canSkip: true,
    checklistItems: [
      { itemKey: 'select_date', itemName: 'Select opening balance date', isRequired: true },
      { itemKey: 'enter_balances', itemName: 'Enter account balances', isRequired: true },
      { itemKey: 'verify_trial', itemName: 'Verify trial balance', isRequired: false },
    ],
  },
  {
    stepNumber: 4,
    stepKey: 'complete',
    stepName: 'Complete Setup',
    description: 'Review and complete your setup',
    isRequired: true,
    canSkip: false,
    checklistItems: [
      { itemKey: 'review_setup', itemName: 'Review configuration', isRequired: true },
      { itemKey: 'invite_users', itemName: 'Invite team members', isRequired: false },
    ],
  },
] as const;
