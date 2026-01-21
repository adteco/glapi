/**
 * Onboarding Service
 *
 * Business logic for organization onboarding including:
 * - Progress tracking and state management
 * - Step completion and validation
 * - Skip/resume functionality
 * - Event logging
 */

import {
  OnboardingRepository,
  onboardingRepository,
  type OrganizationOnboarding,
  type OnboardingStep,
  type OnboardingChecklistItem,
  type OnboardingStatus,
  type OnboardingStepStatus,
} from '@glapi/database';

// =============================================================================
// Types
// =============================================================================

export interface OnboardingProgress {
  id: string;
  organizationId: string;
  status: OnboardingStatus;
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  percentComplete: number;
  startedAt: Date | null;
  completedAt: Date | null;
  lastActivityAt: Date | null;
}

export interface OnboardingStepWithItems {
  step: OnboardingStep;
  checklistItems: OnboardingChecklistItem[];
  isComplete: boolean;
  canProceed: boolean;
}

export interface OnboardingState {
  progress: OnboardingProgress;
  steps: OnboardingStepWithItems[];
  currentStepDetails: OnboardingStepWithItems | null;
  canSkipCurrentStep: boolean;
  isComplete: boolean;
}

export interface CompleteStepResult {
  success: boolean;
  step: OnboardingStep;
  nextStep: OnboardingStep | null;
  isOnboardingComplete: boolean;
  error?: string;
}

export interface SkipStepResult {
  success: boolean;
  step: OnboardingStep;
  nextStep: OnboardingStep | null;
  error?: string;
}

// =============================================================================
// Service
// =============================================================================

export class OnboardingService {
  private repository: OnboardingRepository;

  constructor(repository: OnboardingRepository = onboardingRepository) {
    this.repository = repository;
  }

  // ===========================================================================
  // Onboarding State Management
  // ===========================================================================

  /**
   * Get or initialize onboarding for an organization
   */
  async getOrInitializeOnboarding(
    organizationId: string,
    userId: string
  ): Promise<OnboardingState> {
    let onboarding = await this.repository.getByOrganizationId(organizationId);

    if (!onboarding) {
      const result = await this.repository.initializeOnboarding(organizationId, userId);
      onboarding = result.onboarding;
    }

    return this.getOnboardingState(onboarding.id);
  }

  /**
   * Get full onboarding state
   */
  async getOnboardingState(onboardingId: string): Promise<OnboardingState> {
    const onboarding = await this.repository.getById(onboardingId);
    if (!onboarding) {
      throw new Error('Onboarding not found');
    }

    const steps = await this.repository.getSteps(onboardingId);
    const stepsWithItems: OnboardingStepWithItems[] = [];

    for (const step of steps) {
      const checklistItems = await this.repository.getChecklistItems(step.id);
      const isComplete = await this.repository.isStepComplete(step.id);

      stepsWithItems.push({
        step,
        checklistItems,
        isComplete,
        canProceed: isComplete || step.canSkip,
      });
    }

    const currentStepDetails = stepsWithItems.find(
      s => s.step.stepNumber === onboarding.currentStep
    ) ?? null;

    return {
      progress: this.toProgress(onboarding),
      steps: stepsWithItems,
      currentStepDetails,
      canSkipCurrentStep: currentStepDetails?.step.canSkip ?? false,
      isComplete: onboarding.status === 'completed',
    };
  }

  /**
   * Get onboarding progress summary
   */
  async getProgress(organizationId: string): Promise<OnboardingProgress | null> {
    const onboarding = await this.repository.getByOrganizationId(organizationId);
    if (!onboarding) return null;

    return this.toProgress(onboarding);
  }

  // ===========================================================================
  // Step Management
  // ===========================================================================

  /**
   * Start a step
   */
  async startStep(
    organizationId: string,
    stepKey: string,
    userId: string
  ): Promise<OnboardingStep> {
    const onboarding = await this.repository.getByOrganizationId(organizationId);
    if (!onboarding) {
      throw new Error('Onboarding not found');
    }

    const step = await this.repository.getStepByKey(onboarding.id, stepKey);
    if (!step) {
      throw new Error('Step not found');
    }

    // Check if previous steps are complete
    await this.validateStepAccess(onboarding.id, step.stepNumber);

    // Start the step
    const updatedStep = await this.repository.startStep(step.id);
    if (!updatedStep) {
      throw new Error('Failed to start step');
    }

    // Update onboarding status if first step
    if (onboarding.status === 'not_started') {
      await this.repository.update(onboarding.id, {
        status: 'in_progress',
        startedAt: new Date(),
        lastActivityAt: new Date(),
      });
    }

    // Log event
    await this.repository.logEvent({
      onboardingId: onboarding.id,
      stepId: step.id,
      eventType: 'STEP_STARTED',
      userId,
      eventData: { stepKey },
    });

    return updatedStep;
  }

  /**
   * Complete a step
   */
  async completeStep(
    organizationId: string,
    stepKey: string,
    userId: string,
    stepData?: Record<string, unknown>
  ): Promise<CompleteStepResult> {
    const onboarding = await this.repository.getByOrganizationId(organizationId);
    if (!onboarding) {
      throw new Error('Onboarding not found');
    }

    const step = await this.repository.getStepByKey(onboarding.id, stepKey);
    if (!step) {
      throw new Error('Step not found');
    }

    // Verify step can be completed
    const isComplete = await this.repository.isStepComplete(step.id);
    if (!isComplete && step.isRequired) {
      return {
        success: false,
        step,
        nextStep: null,
        isOnboardingComplete: false,
        error: 'Required checklist items not completed',
      };
    }

    // Complete the step
    const updatedStep = await this.repository.completeStep(step.id, userId);
    if (!updatedStep) {
      throw new Error('Failed to complete step');
    }

    // Save step data if provided
    if (stepData) {
      await this.repository.updateStep(step.id, { stepData });
    }

    // Recalculate progress
    await this.repository.recalculateProgress(onboarding.id);

    // Get next step
    const steps = await this.repository.getSteps(onboarding.id);
    const nextStep = steps.find(s => s.stepNumber > step.stepNumber) ?? null;

    // Check if onboarding is complete
    const updatedOnboarding = await this.repository.getById(onboarding.id);
    const isOnboardingComplete = updatedOnboarding?.status === 'completed';

    // Log event
    await this.repository.logEvent({
      onboardingId: onboarding.id,
      stepId: step.id,
      eventType: isOnboardingComplete ? 'ONBOARDING_COMPLETED' : 'STEP_COMPLETED',
      userId,
      eventData: { stepKey },
    });

    return {
      success: true,
      step: updatedStep,
      nextStep,
      isOnboardingComplete,
    };
  }

  /**
   * Skip a step
   */
  async skipStep(
    organizationId: string,
    stepKey: string,
    userId: string,
    reason?: string
  ): Promise<SkipStepResult> {
    const onboarding = await this.repository.getByOrganizationId(organizationId);
    if (!onboarding) {
      throw new Error('Onboarding not found');
    }

    const step = await this.repository.getStepByKey(onboarding.id, stepKey);
    if (!step) {
      throw new Error('Step not found');
    }

    // Check if step can be skipped
    if (!step.canSkip) {
      return {
        success: false,
        step,
        nextStep: null,
        error: 'This step cannot be skipped',
      };
    }

    // Skip the step
    const updatedStep = await this.repository.skipStep(step.id, userId, reason);
    if (!updatedStep) {
      throw new Error('Failed to skip step');
    }

    // Recalculate progress
    await this.repository.recalculateProgress(onboarding.id);

    // Get next step
    const steps = await this.repository.getSteps(onboarding.id);
    const nextStep = steps.find(s => s.stepNumber > step.stepNumber) ?? null;

    // Log event
    await this.repository.logEvent({
      onboardingId: onboarding.id,
      stepId: step.id,
      eventType: 'STEP_SKIPPED',
      userId,
      eventData: { stepKey, reason },
    });

    return {
      success: true,
      step: updatedStep,
      nextStep,
    };
  }

  /**
   * Go back to a previous step
   */
  async goToStep(
    organizationId: string,
    stepKey: string,
    userId: string
  ): Promise<OnboardingStep> {
    const onboarding = await this.repository.getByOrganizationId(organizationId);
    if (!onboarding) {
      throw new Error('Onboarding not found');
    }

    const step = await this.repository.getStepByKey(onboarding.id, stepKey);
    if (!step) {
      throw new Error('Step not found');
    }

    // Update current step
    await this.repository.update(onboarding.id, {
      currentStep: step.stepNumber,
      lastActivityAt: new Date(),
    });

    // Log event
    await this.repository.logEvent({
      onboardingId: onboarding.id,
      stepId: step.id,
      eventType: 'STEP_NAVIGATED',
      userId,
      eventData: { stepKey },
    });

    return step;
  }

  // ===========================================================================
  // Checklist Item Management
  // ===========================================================================

  /**
   * Complete a checklist item
   */
  async completeChecklistItem(
    organizationId: string,
    itemId: string,
    userId: string
  ): Promise<OnboardingChecklistItem> {
    const onboarding = await this.repository.getByOrganizationId(organizationId);
    if (!onboarding) {
      throw new Error('Onboarding not found');
    }

    const item = await this.repository.completeChecklistItem(itemId, userId);
    if (!item) {
      throw new Error('Checklist item not found');
    }

    // Update last activity
    await this.repository.update(onboarding.id, {
      lastActivityAt: new Date(),
    });

    return item;
  }

  /**
   * Uncomplete a checklist item
   */
  async uncompleteChecklistItem(
    organizationId: string,
    itemId: string
  ): Promise<OnboardingChecklistItem> {
    const onboarding = await this.repository.getByOrganizationId(organizationId);
    if (!onboarding) {
      throw new Error('Onboarding not found');
    }

    const item = await this.repository.uncompleteChecklistItem(itemId);
    if (!item) {
      throw new Error('Checklist item not found');
    }

    return item;
  }

  // ===========================================================================
  // Validation
  // ===========================================================================

  /**
   * Validate that a user can access a step
   */
  private async validateStepAccess(
    onboardingId: string,
    stepNumber: number
  ): Promise<void> {
    const steps = await this.repository.getSteps(onboardingId);

    // Check all previous steps
    for (const step of steps) {
      if (step.stepNumber >= stepNumber) break;

      if (step.status !== 'completed' && step.status !== 'skipped') {
        if (step.isRequired && !step.canSkip) {
          throw new Error(`Step "${step.stepName}" must be completed first`);
        }
      }
    }
  }

  /**
   * Check if step can be accessed
   */
  async canAccessStep(
    organizationId: string,
    stepKey: string
  ): Promise<{ canAccess: boolean; reason?: string }> {
    const onboarding = await this.repository.getByOrganizationId(organizationId);
    if (!onboarding) {
      return { canAccess: false, reason: 'Onboarding not initialized' };
    }

    const step = await this.repository.getStepByKey(onboarding.id, stepKey);
    if (!step) {
      return { canAccess: false, reason: 'Step not found' };
    }

    try {
      await this.validateStepAccess(onboarding.id, step.stepNumber);
      return { canAccess: true };
    } catch (error) {
      return { canAccess: false, reason: (error as Error).message };
    }
  }

  // ===========================================================================
  // Resume Support
  // ===========================================================================

  /**
   * Get resume point for onboarding
   */
  async getResumePoint(organizationId: string): Promise<{
    step: OnboardingStep | null;
    checklistItems: OnboardingChecklistItem[];
  } | null> {
    const onboarding = await this.repository.getByOrganizationId(organizationId);
    if (!onboarding) return null;

    if (onboarding.status === 'completed') {
      return null;
    }

    const steps = await this.repository.getSteps(onboarding.id);
    const currentStep = steps.find(s => s.stepNumber === onboarding.currentStep);

    if (!currentStep) return null;

    const checklistItems = await this.repository.getChecklistItems(currentStep.id);

    return {
      step: currentStep,
      checklistItems,
    };
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  /**
   * Get onboarding events/audit trail
   */
  async getEvents(organizationId: string, limit = 50) {
    const onboarding = await this.repository.getByOrganizationId(organizationId);
    if (!onboarding) {
      return [];
    }

    return this.repository.getEvents(onboarding.id, limit);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private toProgress(onboarding: OrganizationOnboarding): OnboardingProgress {
    return {
      id: onboarding.id,
      organizationId: onboarding.organizationId,
      status: onboarding.status,
      currentStep: onboarding.currentStep,
      totalSteps: onboarding.totalSteps,
      completedSteps: onboarding.completedSteps,
      percentComplete: onboarding.percentComplete,
      startedAt: onboarding.startedAt,
      completedAt: onboarding.completedAt,
      lastActivityAt: onboarding.lastActivityAt,
    };
  }
}

// Export singleton instance
export const onboardingService = new OnboardingService();
