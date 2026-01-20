/**
 * Onboarding Repository
 *
 * Data access layer for organization onboarding state management.
 */

import { eq, and, desc, asc } from 'drizzle-orm';
import { db } from '../db';
import {
  organizationOnboarding,
  onboardingSteps,
  onboardingChecklistItems,
  onboardingEvents,
  type OrganizationOnboarding,
  type NewOrganizationOnboarding,
  type OnboardingStep,
  type NewOnboardingStep,
  type OnboardingChecklistItem,
  type NewOnboardingChecklistItem,
  type OnboardingEvent,
  type NewOnboardingEvent,
  type OnboardingStatus,
  type OnboardingStepStatus,
  DEFAULT_ONBOARDING_STEPS,
} from '../db/schema';

export class OnboardingRepository {
  // ===========================================================================
  // Organization Onboarding
  // ===========================================================================

  /**
   * Get onboarding state for an organization
   */
  async getByOrganizationId(organizationId: string): Promise<OrganizationOnboarding | null> {
    const results = await db
      .select()
      .from(organizationOnboarding)
      .where(eq(organizationOnboarding.organizationId, organizationId))
      .limit(1);

    return results[0] ?? null;
  }

  /**
   * Get onboarding state by ID
   */
  async getById(id: string): Promise<OrganizationOnboarding | null> {
    const results = await db
      .select()
      .from(organizationOnboarding)
      .where(eq(organizationOnboarding.id, id))
      .limit(1);

    return results[0] ?? null;
  }

  /**
   * Create onboarding state for an organization
   */
  async create(data: NewOrganizationOnboarding): Promise<OrganizationOnboarding> {
    const results = await db
      .insert(organizationOnboarding)
      .values(data)
      .returning();

    return results[0];
  }

  /**
   * Update onboarding state
   */
  async update(
    id: string,
    data: Partial<Omit<OrganizationOnboarding, 'id' | 'organizationId' | 'createdAt'>>
  ): Promise<OrganizationOnboarding | null> {
    const results = await db
      .update(organizationOnboarding)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizationOnboarding.id, id))
      .returning();

    return results[0] ?? null;
  }

  /**
   * Initialize onboarding for an organization with default steps
   */
  async initializeOnboarding(
    organizationId: string,
    userId: string
  ): Promise<{
    onboarding: OrganizationOnboarding;
    steps: OnboardingStep[];
  }> {
    // Check if already exists
    const existing = await this.getByOrganizationId(organizationId);
    if (existing) {
      const steps = await this.getSteps(existing.id);
      return { onboarding: existing, steps };
    }

    // Create onboarding record
    const onboarding = await this.create({
      organizationId,
      status: 'not_started',
      currentStep: 0,
      totalSteps: DEFAULT_ONBOARDING_STEPS.length,
      completedSteps: 0,
      percentComplete: 0,
      startedBy: userId,
    });

    // Create default steps
    const steps: OnboardingStep[] = [];
    for (const stepConfig of DEFAULT_ONBOARDING_STEPS) {
      const step = await this.createStep({
        onboardingId: onboarding.id,
        stepNumber: stepConfig.stepNumber,
        stepKey: stepConfig.stepKey,
        stepName: stepConfig.stepName,
        description: stepConfig.description,
        isRequired: stepConfig.isRequired,
        canSkip: stepConfig.canSkip,
        status: 'not_started',
      });

      // Create checklist items for this step
      for (let i = 0; i < stepConfig.checklistItems.length; i++) {
        const item = stepConfig.checklistItems[i];
        await this.createChecklistItem({
          stepId: step.id,
          itemKey: item.itemKey,
          itemName: item.itemName,
          isRequired: item.isRequired,
          sortOrder: i,
        });
      }

      steps.push(step);
    }

    // Log initialization event
    await this.logEvent({
      onboardingId: onboarding.id,
      eventType: 'ONBOARDING_INITIALIZED',
      userId,
      eventData: { totalSteps: DEFAULT_ONBOARDING_STEPS.length },
    });

    return { onboarding, steps };
  }

  // ===========================================================================
  // Onboarding Steps
  // ===========================================================================

  /**
   * Get all steps for an onboarding
   */
  async getSteps(onboardingId: string): Promise<OnboardingStep[]> {
    return db
      .select()
      .from(onboardingSteps)
      .where(eq(onboardingSteps.onboardingId, onboardingId))
      .orderBy(asc(onboardingSteps.stepNumber));
  }

  /**
   * Get a specific step by ID
   */
  async getStepById(stepId: string): Promise<OnboardingStep | null> {
    const results = await db
      .select()
      .from(onboardingSteps)
      .where(eq(onboardingSteps.id, stepId))
      .limit(1);

    return results[0] ?? null;
  }

  /**
   * Get a step by key within an onboarding
   */
  async getStepByKey(
    onboardingId: string,
    stepKey: string
  ): Promise<OnboardingStep | null> {
    const results = await db
      .select()
      .from(onboardingSteps)
      .where(
        and(
          eq(onboardingSteps.onboardingId, onboardingId),
          eq(onboardingSteps.stepKey, stepKey)
        )
      )
      .limit(1);

    return results[0] ?? null;
  }

  /**
   * Create a new step
   */
  async createStep(data: NewOnboardingStep): Promise<OnboardingStep> {
    const results = await db
      .insert(onboardingSteps)
      .values(data)
      .returning();

    return results[0];
  }

  /**
   * Update a step
   */
  async updateStep(
    stepId: string,
    data: Partial<Omit<OnboardingStep, 'id' | 'onboardingId' | 'createdAt'>>
  ): Promise<OnboardingStep | null> {
    const results = await db
      .update(onboardingSteps)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(onboardingSteps.id, stepId))
      .returning();

    return results[0] ?? null;
  }

  /**
   * Start a step
   */
  async startStep(stepId: string): Promise<OnboardingStep | null> {
    return this.updateStep(stepId, {
      status: 'in_progress',
      startedAt: new Date(),
    });
  }

  /**
   * Complete a step
   */
  async completeStep(stepId: string, userId: string): Promise<OnboardingStep | null> {
    return this.updateStep(stepId, {
      status: 'completed',
      completedAt: new Date(),
      completedBy: userId,
    });
  }

  /**
   * Skip a step
   */
  async skipStep(
    stepId: string,
    userId: string,
    reason?: string
  ): Promise<OnboardingStep | null> {
    return this.updateStep(stepId, {
      status: 'skipped',
      skippedAt: new Date(),
      skippedBy: userId,
      skipReason: reason,
    });
  }

  // ===========================================================================
  // Checklist Items
  // ===========================================================================

  /**
   * Get checklist items for a step
   */
  async getChecklistItems(stepId: string): Promise<OnboardingChecklistItem[]> {
    return db
      .select()
      .from(onboardingChecklistItems)
      .where(eq(onboardingChecklistItems.stepId, stepId))
      .orderBy(asc(onboardingChecklistItems.sortOrder));
  }

  /**
   * Create a checklist item
   */
  async createChecklistItem(
    data: NewOnboardingChecklistItem
  ): Promise<OnboardingChecklistItem> {
    const results = await db
      .insert(onboardingChecklistItems)
      .values(data)
      .returning();

    return results[0];
  }

  /**
   * Update a checklist item
   */
  async updateChecklistItem(
    itemId: string,
    data: Partial<Omit<OnboardingChecklistItem, 'id' | 'stepId' | 'createdAt'>>
  ): Promise<OnboardingChecklistItem | null> {
    const results = await db
      .update(onboardingChecklistItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(onboardingChecklistItems.id, itemId))
      .returning();

    return results[0] ?? null;
  }

  /**
   * Complete a checklist item
   */
  async completeChecklistItem(
    itemId: string,
    userId: string
  ): Promise<OnboardingChecklistItem | null> {
    return this.updateChecklistItem(itemId, {
      isCompleted: true,
      completedAt: new Date(),
      completedBy: userId,
    });
  }

  /**
   * Uncomplete a checklist item
   */
  async uncompleteChecklistItem(itemId: string): Promise<OnboardingChecklistItem | null> {
    return this.updateChecklistItem(itemId, {
      isCompleted: false,
      completedAt: null,
      completedBy: null,
    });
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  /**
   * Log an onboarding event
   */
  async logEvent(data: NewOnboardingEvent): Promise<OnboardingEvent> {
    const results = await db
      .insert(onboardingEvents)
      .values(data)
      .returning();

    return results[0];
  }

  /**
   * Get events for an onboarding
   */
  async getEvents(
    onboardingId: string,
    limit = 50
  ): Promise<OnboardingEvent[]> {
    return db
      .select()
      .from(onboardingEvents)
      .where(eq(onboardingEvents.onboardingId, onboardingId))
      .orderBy(desc(onboardingEvents.createdAt))
      .limit(limit);
  }

  // ===========================================================================
  // Progress Calculations
  // ===========================================================================

  /**
   * Recalculate onboarding progress
   */
  async recalculateProgress(onboardingId: string): Promise<OrganizationOnboarding | null> {
    const steps = await this.getSteps(onboardingId);

    const completedSteps = steps.filter(
      s => s.status === 'completed' || s.status === 'skipped'
    ).length;

    const totalSteps = steps.length;
    const percentComplete = totalSteps > 0
      ? Math.round((completedSteps / totalSteps) * 100)
      : 0;

    // Determine overall status
    let status: OnboardingStatus = 'not_started';
    if (completedSteps === totalSteps && totalSteps > 0) {
      status = 'completed';
    } else if (completedSteps > 0) {
      status = 'in_progress';
    }

    // Find current step (first non-completed step)
    const currentStep = steps.find(
      s => s.status !== 'completed' && s.status !== 'skipped'
    )?.stepNumber ?? totalSteps - 1;

    return this.update(onboardingId, {
      status,
      currentStep,
      completedSteps,
      percentComplete,
      lastActivityAt: new Date(),
      completedAt: status === 'completed' ? new Date() : null,
    });
  }

  /**
   * Check if a step is complete (all required checklist items done)
   */
  async isStepComplete(stepId: string): Promise<boolean> {
    const items = await this.getChecklistItems(stepId);
    const requiredItems = items.filter(i => i.isRequired);

    return requiredItems.every(i => i.isCompleted);
  }
}

// Export singleton instance
export const onboardingRepository = new OnboardingRepository();
