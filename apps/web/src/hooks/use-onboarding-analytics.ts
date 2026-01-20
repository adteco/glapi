'use client';

import { useCallback, useRef } from 'react';
import { useAnalytics } from '@/components/providers/posthog-provider';

// =============================================================================
// Types
// =============================================================================

export type OnboardingStepKey =
  | 'welcome'
  | 'organization'
  | 'chart_of_accounts'
  | 'opening_balances'
  | 'integrations';

export interface OnboardingEventProperties {
  organization_id?: string;
  step_key?: OnboardingStepKey;
  step_index?: number;
  total_steps?: number;
  time_on_step_seconds?: number;
  [key: string]: unknown;
}

// =============================================================================
// Event Names
// =============================================================================

export const ONBOARDING_EVENTS = {
  // Session events
  STARTED: 'onboarding_started',
  COMPLETED: 'onboarding_completed',
  ABANDONED: 'onboarding_abandoned',
  RESUMED: 'onboarding_resumed',

  // Step events
  STEP_VIEWED: 'onboarding_step_viewed',
  STEP_STARTED: 'onboarding_step_started',
  STEP_COMPLETED: 'onboarding_step_completed',
  STEP_SKIPPED: 'onboarding_step_skipped',
  STEP_ERROR: 'onboarding_step_error',

  // Interaction events
  HELP_CLICKED: 'onboarding_help_clicked',
  BACK_CLICKED: 'onboarding_back_clicked',
  TEMPLATE_SELECTED: 'onboarding_template_selected',
  ACCOUNT_MODIFIED: 'onboarding_account_modified',
  BALANCE_ENTERED: 'onboarding_balance_entered',
  VALIDATION_ERROR: 'onboarding_validation_error',

  // Checklist events
  CHECKLIST_ITEM_COMPLETED: 'onboarding_checklist_item_completed',
  CHECKLIST_ITEM_UNCOMPLETED: 'onboarding_checklist_item_uncompleted',
} as const;

// =============================================================================
// Hook
// =============================================================================

export function useOnboardingAnalytics(organizationId?: string) {
  const { track } = useAnalytics();
  const stepStartTimeRef = useRef<number | null>(null);

  // Track step view with timing
  const trackStepViewed = useCallback(
    (
      stepKey: OnboardingStepKey,
      stepIndex: number,
      totalSteps: number,
      additionalProps?: Record<string, unknown>
    ) => {
      stepStartTimeRef.current = Date.now();

      track(ONBOARDING_EVENTS.STEP_VIEWED, {
        organization_id: organizationId,
        step_key: stepKey,
        step_index: stepIndex,
        total_steps: totalSteps,
        progress_percentage: Math.round((stepIndex / totalSteps) * 100),
        ...additionalProps,
      });
    },
    [organizationId, track]
  );

  // Track step started (user began interacting)
  const trackStepStarted = useCallback(
    (stepKey: OnboardingStepKey, additionalProps?: Record<string, unknown>) => {
      track(ONBOARDING_EVENTS.STEP_STARTED, {
        organization_id: organizationId,
        step_key: stepKey,
        ...additionalProps,
      });
    },
    [organizationId, track]
  );

  // Track step completion with time spent
  const trackStepCompleted = useCallback(
    (
      stepKey: OnboardingStepKey,
      stepIndex: number,
      totalSteps: number,
      additionalProps?: Record<string, unknown>
    ) => {
      const timeOnStep = stepStartTimeRef.current
        ? Math.round((Date.now() - stepStartTimeRef.current) / 1000)
        : undefined;

      track(ONBOARDING_EVENTS.STEP_COMPLETED, {
        organization_id: organizationId,
        step_key: stepKey,
        step_index: stepIndex,
        total_steps: totalSteps,
        time_on_step_seconds: timeOnStep,
        progress_percentage: Math.round(((stepIndex + 1) / totalSteps) * 100),
        ...additionalProps,
      });

      stepStartTimeRef.current = null;
    },
    [organizationId, track]
  );

  // Track step skipped
  const trackStepSkipped = useCallback(
    (
      stepKey: OnboardingStepKey,
      reason?: string,
      additionalProps?: Record<string, unknown>
    ) => {
      const timeOnStep = stepStartTimeRef.current
        ? Math.round((Date.now() - stepStartTimeRef.current) / 1000)
        : undefined;

      track(ONBOARDING_EVENTS.STEP_SKIPPED, {
        organization_id: organizationId,
        step_key: stepKey,
        skip_reason: reason,
        time_on_step_seconds: timeOnStep,
        ...additionalProps,
      });

      stepStartTimeRef.current = null;
    },
    [organizationId, track]
  );

  // Track onboarding started
  const trackOnboardingStarted = useCallback(
    (additionalProps?: Record<string, unknown>) => {
      track(ONBOARDING_EVENTS.STARTED, {
        organization_id: organizationId,
        timestamp: new Date().toISOString(),
        ...additionalProps,
      });
    },
    [organizationId, track]
  );

  // Track onboarding completed
  const trackOnboardingCompleted = useCallback(
    (
      totalTimeSeconds: number,
      stepsCompleted: number,
      stepsSkipped: number,
      additionalProps?: Record<string, unknown>
    ) => {
      track(ONBOARDING_EVENTS.COMPLETED, {
        organization_id: organizationId,
        total_time_seconds: totalTimeSeconds,
        steps_completed: stepsCompleted,
        steps_skipped: stepsSkipped,
        completion_rate: Math.round(
          (stepsCompleted / (stepsCompleted + stepsSkipped)) * 100
        ),
        timestamp: new Date().toISOString(),
        ...additionalProps,
      });
    },
    [organizationId, track]
  );

  // Track onboarding resumed
  const trackOnboardingResumed = useCallback(
    (
      resumeStepKey: OnboardingStepKey,
      additionalProps?: Record<string, unknown>
    ) => {
      track(ONBOARDING_EVENTS.RESUMED, {
        organization_id: organizationId,
        resume_step_key: resumeStepKey,
        timestamp: new Date().toISOString(),
        ...additionalProps,
      });
    },
    [organizationId, track]
  );

  // Track help clicked
  const trackHelpClicked = useCallback(
    (
      stepKey: OnboardingStepKey,
      helpTopic: string,
      additionalProps?: Record<string, unknown>
    ) => {
      track(ONBOARDING_EVENTS.HELP_CLICKED, {
        organization_id: organizationId,
        step_key: stepKey,
        help_topic: helpTopic,
        ...additionalProps,
      });
    },
    [organizationId, track]
  );

  // Track template selection (for CoA setup)
  const trackTemplateSelected = useCallback(
    (
      templateId: string,
      templateName: string,
      additionalProps?: Record<string, unknown>
    ) => {
      track(ONBOARDING_EVENTS.TEMPLATE_SELECTED, {
        organization_id: organizationId,
        template_id: templateId,
        template_name: templateName,
        step_key: 'chart_of_accounts',
        ...additionalProps,
      });
    },
    [organizationId, track]
  );

  // Track validation error
  const trackValidationError = useCallback(
    (
      stepKey: OnboardingStepKey,
      errorType: string,
      errorMessage: string,
      additionalProps?: Record<string, unknown>
    ) => {
      track(ONBOARDING_EVENTS.VALIDATION_ERROR, {
        organization_id: organizationId,
        step_key: stepKey,
        error_type: errorType,
        error_message: errorMessage,
        ...additionalProps,
      });
    },
    [organizationId, track]
  );

  // Track step error
  const trackStepError = useCallback(
    (
      stepKey: OnboardingStepKey,
      errorType: string,
      errorMessage: string,
      additionalProps?: Record<string, unknown>
    ) => {
      track(ONBOARDING_EVENTS.STEP_ERROR, {
        organization_id: organizationId,
        step_key: stepKey,
        error_type: errorType,
        error_message: errorMessage,
        ...additionalProps,
      });
    },
    [organizationId, track]
  );

  // Track checklist item completed
  const trackChecklistItemCompleted = useCallback(
    (
      stepKey: OnboardingStepKey,
      itemKey: string,
      additionalProps?: Record<string, unknown>
    ) => {
      track(ONBOARDING_EVENTS.CHECKLIST_ITEM_COMPLETED, {
        organization_id: organizationId,
        step_key: stepKey,
        item_key: itemKey,
        ...additionalProps,
      });
    },
    [organizationId, track]
  );

  return {
    // Session tracking
    trackOnboardingStarted,
    trackOnboardingCompleted,
    trackOnboardingResumed,

    // Step tracking
    trackStepViewed,
    trackStepStarted,
    trackStepCompleted,
    trackStepSkipped,
    trackStepError,

    // Interaction tracking
    trackHelpClicked,
    trackTemplateSelected,
    trackValidationError,
    trackChecklistItemCompleted,
  };
}
