/**
 * tRPC Router for Onboarding Operations
 *
 * Provides API endpoints for the onboarding wizard:
 * - State management (get, initialize)
 * - Step management (start, complete, skip, navigate)
 * - Checklist item management
 * - Progress tracking
 * - Resume support
 * - Event history
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { onboardingService } from '@glapi/api-service';

// =============================================================================
// Input Schemas
// =============================================================================

const stepKeyEnum = z.enum([
  'welcome',
  'organization',
  'chart_of_accounts',
  'opening_balances',
  'integrations',
]);

const completeStepInput = z.object({
  stepKey: stepKeyEnum,
  stepData: z.record(z.unknown()).optional(),
});

const skipStepInput = z.object({
  stepKey: stepKeyEnum,
  reason: z.string().optional(),
});

const goToStepInput = z.object({
  stepKey: stepKeyEnum,
});

// =============================================================================
// Router
// =============================================================================

export const onboardingRouter = router({
  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  /**
   * Get or initialize onboarding for the current organization.
   * If onboarding doesn't exist, it will be created with default steps.
   */
  getOrInitialize: protectedProcedure
    .query(async ({ ctx }) => {
      return onboardingService.getOrInitializeOnboarding(
        ctx.organizationId,
        ctx.user.id
      );
    }),

  /**
   * Get current onboarding progress summary.
   */
  getProgress: protectedProcedure
    .query(async ({ ctx }) => {
      return onboardingService.getProgress(ctx.organizationId);
    }),

  /**
   * Get resume point for continuing onboarding.
   * Returns the current step and its checklist items.
   */
  getResumePoint: protectedProcedure
    .query(async ({ ctx }) => {
      return onboardingService.getResumePoint(ctx.organizationId);
    }),

  /**
   * Check if a step can be accessed (all previous required steps complete).
   */
  canAccessStep: protectedProcedure
    .input(z.object({ stepKey: stepKeyEnum }))
    .query(async ({ input, ctx }) => {
      return onboardingService.canAccessStep(
        ctx.organizationId,
        input.stepKey
      );
    }),

  // ---------------------------------------------------------------------------
  // Step Management
  // ---------------------------------------------------------------------------

  /**
   * Start a step (marks it as in_progress).
   */
  startStep: protectedProcedure
    .input(z.object({ stepKey: stepKeyEnum }))
    .mutation(async ({ input, ctx }) => {
      return onboardingService.startStep(
        ctx.organizationId,
        input.stepKey,
        ctx.user.id
      );
    }),

  /**
   * Complete a step.
   * Will validate that all required checklist items are done.
   */
  completeStep: protectedProcedure
    .input(completeStepInput)
    .mutation(async ({ input, ctx }) => {
      return onboardingService.completeStep(
        ctx.organizationId,
        input.stepKey,
        ctx.user.id,
        input.stepData
      );
    }),

  /**
   * Skip a step (only if step.canSkip is true).
   */
  skipStep: protectedProcedure
    .input(skipStepInput)
    .mutation(async ({ input, ctx }) => {
      return onboardingService.skipStep(
        ctx.organizationId,
        input.stepKey,
        ctx.user.id,
        input.reason
      );
    }),

  /**
   * Navigate to a specific step (for going back).
   */
  goToStep: protectedProcedure
    .input(goToStepInput)
    .mutation(async ({ input, ctx }) => {
      return onboardingService.goToStep(
        ctx.organizationId,
        input.stepKey,
        ctx.user.id
      );
    }),

  // ---------------------------------------------------------------------------
  // Checklist Item Management
  // ---------------------------------------------------------------------------

  /**
   * Mark a checklist item as complete.
   */
  completeChecklistItem: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return onboardingService.completeChecklistItem(
        ctx.organizationId,
        input.itemId,
        ctx.user.id
      );
    }),

  /**
   * Mark a checklist item as incomplete (undo completion).
   */
  uncompleteChecklistItem: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return onboardingService.uncompleteChecklistItem(
        ctx.organizationId,
        input.itemId
      );
    }),

  // ---------------------------------------------------------------------------
  // Event History
  // ---------------------------------------------------------------------------

  /**
   * Get onboarding event history (audit trail).
   */
  getEvents: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional())
    .query(async ({ input, ctx }) => {
      return onboardingService.getEvents(
        ctx.organizationId,
        input?.limit ?? 50
      );
    }),

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /**
   * Get default step configuration (for UI rendering).
   */
  getStepConfig: protectedProcedure
    .query(() => {
      return {
        steps: [
          {
            key: 'welcome',
            name: 'Welcome',
            description: 'Get started with GLAPI',
            icon: 'HandWave',
            estimatedTime: '2 min',
          },
          {
            key: 'organization',
            name: 'Organization Setup',
            description: 'Configure your company details',
            icon: 'Building',
            estimatedTime: '5 min',
          },
          {
            key: 'chart_of_accounts',
            name: 'Chart of Accounts',
            description: 'Set up your account structure',
            icon: 'ListTree',
            estimatedTime: '10 min',
          },
          {
            key: 'opening_balances',
            name: 'Opening Balances',
            description: 'Enter your starting balances',
            icon: 'Calculator',
            estimatedTime: '15 min',
          },
          {
            key: 'integrations',
            name: 'Integrations',
            description: 'Connect your tools and systems',
            icon: 'Plug',
            estimatedTime: '5 min',
          },
        ],
      };
    }),
});
