/**
 * Onboarding Service Tests
 *
 * Tests for onboarding wizard functionality including:
 * - Step gating (cannot skip required steps)
 * - Progress tracking
 * - Skip/resume functionality
 * - Checklist item management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the database module before importing the service
vi.mock('@glapi/database', () => ({
  OnboardingRepository: vi.fn(),
  onboardingRepository: {},
}));

import { OnboardingService } from '../onboarding-service';

// =============================================================================
// Mock Data
// =============================================================================

const mockOrganizationId = 'org-123';
const mockUserId = 'user-456';
const mockOnboardingId = 'onboarding-789';

const createMockStep = (overrides = {}) => ({
  id: 'step-1',
  onboardingId: mockOnboardingId,
  stepNumber: 0,
  stepKey: 'welcome',
  stepName: 'Welcome',
  description: 'Get started',
  isRequired: false,
  canSkip: true,
  status: 'not_started' as const,
  startedAt: null,
  completedAt: null,
  completedBy: null,
  skippedAt: null,
  skippedBy: null,
  skipReason: null,
  stepData: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockOnboarding = (overrides = {}) => ({
  id: mockOnboardingId,
  organizationId: mockOrganizationId,
  status: 'not_started' as const,
  currentStep: 0,
  totalSteps: 5,
  completedSteps: 0,
  percentComplete: 0,
  startedAt: null,
  completedAt: null,
  lastActivityAt: null,
  startedBy: mockUserId,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockChecklistItem = (overrides = {}) => ({
  id: 'item-1',
  stepId: 'step-1',
  itemKey: 'item_1',
  itemName: 'Complete task 1',
  isRequired: true,
  isCompleted: false,
  completedAt: null,
  completedBy: null,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// =============================================================================
// Mock Repository
// =============================================================================

const mockRepository = {
  getByOrganizationId: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  initializeOnboarding: vi.fn(),
  getSteps: vi.fn(),
  getStepById: vi.fn(),
  getStepByKey: vi.fn(),
  createStep: vi.fn(),
  updateStep: vi.fn(),
  startStep: vi.fn(),
  completeStep: vi.fn(),
  skipStep: vi.fn(),
  getChecklistItems: vi.fn(),
  createChecklistItem: vi.fn(),
  updateChecklistItem: vi.fn(),
  completeChecklistItem: vi.fn(),
  uncompleteChecklistItem: vi.fn(),
  logEvent: vi.fn(),
  getEvents: vi.fn(),
  recalculateProgress: vi.fn(),
  isStepComplete: vi.fn(),
};

// =============================================================================
// Tests
// =============================================================================

describe('OnboardingService', () => {
  let service: OnboardingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OnboardingService(mockRepository as any);
  });

  // ===========================================================================
  // Initialization Tests
  // ===========================================================================

  describe('getOrInitializeOnboarding', () => {
    it('should return existing onboarding state', async () => {
      const mockOnboarding = createMockOnboarding();
      const mockSteps = [createMockStep()];

      mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);
      mockRepository.getById.mockResolvedValue(mockOnboarding);
      mockRepository.getSteps.mockResolvedValue(mockSteps);
      mockRepository.getChecklistItems.mockResolvedValue([]);
      mockRepository.isStepComplete.mockResolvedValue(false);

      const result = await service.getOrInitializeOnboarding(mockOrganizationId, mockUserId);

      expect(mockRepository.getByOrganizationId).toHaveBeenCalledWith(mockOrganizationId);
      expect(result.progress.organizationId).toBe(mockOrganizationId);
      expect(result.steps).toHaveLength(1);
    });

    it('should initialize new onboarding if not exists', async () => {
      const mockOnboarding = createMockOnboarding();
      const mockSteps = [createMockStep()];

      mockRepository.getByOrganizationId.mockResolvedValue(null);
      mockRepository.initializeOnboarding.mockResolvedValue({
        onboarding: mockOnboarding,
        steps: mockSteps,
      });
      mockRepository.getById.mockResolvedValue(mockOnboarding);
      mockRepository.getSteps.mockResolvedValue(mockSteps);
      mockRepository.getChecklistItems.mockResolvedValue([]);
      mockRepository.isStepComplete.mockResolvedValue(false);

      const result = await service.getOrInitializeOnboarding(mockOrganizationId, mockUserId);

      expect(mockRepository.initializeOnboarding).toHaveBeenCalledWith(mockOrganizationId, mockUserId);
      expect(result.progress.organizationId).toBe(mockOrganizationId);
    });
  });

  // ===========================================================================
  // Step Gating Tests
  // ===========================================================================

  describe('step gating', () => {
    describe('startStep', () => {
      it('should allow starting the first step', async () => {
        const mockOnboarding = createMockOnboarding();
        const mockStep = createMockStep({ stepNumber: 0 });

        mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);
        mockRepository.getStepByKey.mockResolvedValue(mockStep);
        mockRepository.getSteps.mockResolvedValue([mockStep]);
        mockRepository.startStep.mockResolvedValue({ ...mockStep, status: 'in_progress' });
        mockRepository.update.mockResolvedValue(mockOnboarding);
        mockRepository.logEvent.mockResolvedValue({});

        const result = await service.startStep(mockOrganizationId, 'welcome', mockUserId);

        expect(result.status).toBe('in_progress');
      });

      it('should block starting a step if previous required steps are incomplete', async () => {
        const mockOnboarding = createMockOnboarding();
        const step1 = createMockStep({
          id: 'step-1',
          stepNumber: 0,
          stepKey: 'welcome',
          isRequired: true,
          canSkip: false,
          status: 'not_started',
        });
        const step2 = createMockStep({
          id: 'step-2',
          stepNumber: 1,
          stepKey: 'organization',
          isRequired: true,
          status: 'not_started',
        });

        mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);
        mockRepository.getStepByKey.mockResolvedValue(step2);
        mockRepository.getSteps.mockResolvedValue([step1, step2]);

        await expect(
          service.startStep(mockOrganizationId, 'organization', mockUserId)
        ).rejects.toThrow('Step "Welcome" must be completed first');
      });

      it('should allow starting a step if previous steps are completed or skipped', async () => {
        const mockOnboarding = createMockOnboarding();
        const step1 = createMockStep({
          id: 'step-1',
          stepNumber: 0,
          stepKey: 'welcome',
          status: 'completed',
        });
        const step2 = createMockStep({
          id: 'step-2',
          stepNumber: 1,
          stepKey: 'organization',
          status: 'not_started',
        });

        mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);
        mockRepository.getStepByKey.mockResolvedValue(step2);
        mockRepository.getSteps.mockResolvedValue([step1, step2]);
        mockRepository.startStep.mockResolvedValue({ ...step2, status: 'in_progress' });
        mockRepository.logEvent.mockResolvedValue({});

        const result = await service.startStep(mockOrganizationId, 'organization', mockUserId);

        expect(result.status).toBe('in_progress');
      });
    });

    describe('completeStep', () => {
      it('should complete a step when all required checklist items are done', async () => {
        const mockOnboarding = createMockOnboarding();
        const mockStep = createMockStep({ status: 'in_progress' });
        const mockNextStep = createMockStep({
          id: 'step-2',
          stepNumber: 1,
          stepKey: 'organization',
        });

        mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);
        mockRepository.getStepByKey.mockResolvedValue(mockStep);
        mockRepository.isStepComplete.mockResolvedValue(true);
        mockRepository.completeStep.mockResolvedValue({ ...mockStep, status: 'completed' });
        mockRepository.recalculateProgress.mockResolvedValue(mockOnboarding);
        mockRepository.getSteps.mockResolvedValue([mockStep, mockNextStep]);
        mockRepository.getById.mockResolvedValue(mockOnboarding);
        mockRepository.logEvent.mockResolvedValue({});

        const result = await service.completeStep(mockOrganizationId, 'welcome', mockUserId);

        expect(result.success).toBe(true);
        expect(result.nextStep).toBeTruthy();
      });

      it('should block completion if required checklist items are incomplete', async () => {
        const mockOnboarding = createMockOnboarding();
        const mockStep = createMockStep({
          status: 'in_progress',
          isRequired: true,
        });

        mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);
        mockRepository.getStepByKey.mockResolvedValue(mockStep);
        mockRepository.isStepComplete.mockResolvedValue(false);

        const result = await service.completeStep(mockOrganizationId, 'welcome', mockUserId);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Required checklist items not completed');
      });

      it('should allow completion without checklist items if step is not required', async () => {
        const mockOnboarding = createMockOnboarding();
        const mockStep = createMockStep({
          status: 'in_progress',
          isRequired: false,
        });

        mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);
        mockRepository.getStepByKey.mockResolvedValue(mockStep);
        mockRepository.isStepComplete.mockResolvedValue(false);
        mockRepository.completeStep.mockResolvedValue({ ...mockStep, status: 'completed' });
        mockRepository.recalculateProgress.mockResolvedValue(mockOnboarding);
        mockRepository.getSteps.mockResolvedValue([mockStep]);
        mockRepository.getById.mockResolvedValue(mockOnboarding);
        mockRepository.logEvent.mockResolvedValue({});

        const result = await service.completeStep(mockOrganizationId, 'welcome', mockUserId);

        expect(result.success).toBe(true);
      });
    });

    describe('skipStep', () => {
      it('should allow skipping a step when canSkip is true', async () => {
        const mockOnboarding = createMockOnboarding();
        const mockStep = createMockStep({
          canSkip: true,
          status: 'in_progress',
        });
        const mockNextStep = createMockStep({
          id: 'step-2',
          stepNumber: 1,
          stepKey: 'organization',
        });

        mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);
        mockRepository.getStepByKey.mockResolvedValue(mockStep);
        mockRepository.skipStep.mockResolvedValue({ ...mockStep, status: 'skipped' });
        mockRepository.recalculateProgress.mockResolvedValue(mockOnboarding);
        mockRepository.getSteps.mockResolvedValue([mockStep, mockNextStep]);
        mockRepository.logEvent.mockResolvedValue({});

        const result = await service.skipStep(mockOrganizationId, 'welcome', mockUserId, 'No time');

        expect(result.success).toBe(true);
        expect(result.nextStep).toBeTruthy();
      });

      it('should block skipping when canSkip is false', async () => {
        const mockOnboarding = createMockOnboarding();
        const mockStep = createMockStep({
          canSkip: false,
          status: 'in_progress',
        });

        mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);
        mockRepository.getStepByKey.mockResolvedValue(mockStep);

        const result = await service.skipStep(mockOrganizationId, 'welcome', mockUserId);

        expect(result.success).toBe(false);
        expect(result.error).toBe('This step cannot be skipped');
      });
    });

    describe('canAccessStep', () => {
      it('should return canAccess=true when all previous steps are complete', async () => {
        const mockOnboarding = createMockOnboarding();
        const step1 = createMockStep({
          id: 'step-1',
          stepNumber: 0,
          stepKey: 'welcome',
          status: 'completed',
        });
        const step2 = createMockStep({
          id: 'step-2',
          stepNumber: 1,
          stepKey: 'organization',
          status: 'not_started',
        });

        mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);
        mockRepository.getStepByKey.mockResolvedValue(step2);
        mockRepository.getSteps.mockResolvedValue([step1, step2]);

        const result = await service.canAccessStep(mockOrganizationId, 'organization');

        expect(result.canAccess).toBe(true);
      });

      it('should return canAccess=false when required previous steps are incomplete', async () => {
        const mockOnboarding = createMockOnboarding();
        const step1 = createMockStep({
          id: 'step-1',
          stepNumber: 0,
          stepKey: 'welcome',
          isRequired: true,
          canSkip: false,
          status: 'not_started',
        });
        const step2 = createMockStep({
          id: 'step-2',
          stepNumber: 1,
          stepKey: 'organization',
          status: 'not_started',
        });

        mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);
        mockRepository.getStepByKey.mockResolvedValue(step2);
        mockRepository.getSteps.mockResolvedValue([step1, step2]);

        const result = await service.canAccessStep(mockOrganizationId, 'organization');

        expect(result.canAccess).toBe(false);
        expect(result.reason).toContain('Welcome');
      });

      it('should return canAccess=false for non-existent organization', async () => {
        mockRepository.getByOrganizationId.mockResolvedValue(null);

        const result = await service.canAccessStep('non-existent', 'welcome');

        expect(result.canAccess).toBe(false);
        expect(result.reason).toBe('Onboarding not initialized');
      });
    });
  });

  // ===========================================================================
  // Resume Functionality Tests
  // ===========================================================================

  describe('resume functionality', () => {
    describe('getResumePoint', () => {
      it('should return current step and checklist items', async () => {
        const mockOnboarding = createMockOnboarding({
          status: 'in_progress',
          currentStep: 1,
        });
        const mockStep = createMockStep({
          stepNumber: 1,
          stepKey: 'organization',
        });
        const mockItems = [
          createMockChecklistItem({ id: 'item-1', itemName: 'Task 1' }),
          createMockChecklistItem({ id: 'item-2', itemName: 'Task 2' }),
        ];

        mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);
        mockRepository.getSteps.mockResolvedValue([
          createMockStep({ stepNumber: 0 }),
          mockStep,
        ]);
        mockRepository.getChecklistItems.mockResolvedValue(mockItems);

        const result = await service.getResumePoint(mockOrganizationId);

        expect(result).not.toBeNull();
        expect(result?.step?.stepKey).toBe('organization');
        expect(result?.checklistItems).toHaveLength(2);
      });

      it('should return null for completed onboarding', async () => {
        const mockOnboarding = createMockOnboarding({
          status: 'completed',
        });

        mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);

        const result = await service.getResumePoint(mockOrganizationId);

        expect(result).toBeNull();
      });

      it('should return null for non-existent organization', async () => {
        mockRepository.getByOrganizationId.mockResolvedValue(null);

        const result = await service.getResumePoint('non-existent');

        expect(result).toBeNull();
      });
    });
  });

  // ===========================================================================
  // Checklist Item Tests
  // ===========================================================================

  describe('checklist items', () => {
    describe('completeChecklistItem', () => {
      it('should mark a checklist item as complete', async () => {
        const mockOnboarding = createMockOnboarding();
        const mockItem = createMockChecklistItem();

        mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);
        mockRepository.completeChecklistItem.mockResolvedValue({
          ...mockItem,
          isCompleted: true,
          completedAt: new Date(),
          completedBy: mockUserId,
        });
        mockRepository.update.mockResolvedValue(mockOnboarding);

        const result = await service.completeChecklistItem(
          mockOrganizationId,
          mockItem.id,
          mockUserId
        );

        expect(result.isCompleted).toBe(true);
        expect(result.completedBy).toBe(mockUserId);
      });

      it('should throw error for non-existent organization', async () => {
        mockRepository.getByOrganizationId.mockResolvedValue(null);

        await expect(
          service.completeChecklistItem('non-existent', 'item-1', mockUserId)
        ).rejects.toThrow('Onboarding not found');
      });
    });

    describe('uncompleteChecklistItem', () => {
      it('should mark a checklist item as incomplete', async () => {
        const mockOnboarding = createMockOnboarding();
        const mockItem = createMockChecklistItem({ isCompleted: true });

        mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);
        mockRepository.uncompleteChecklistItem.mockResolvedValue({
          ...mockItem,
          isCompleted: false,
          completedAt: null,
          completedBy: null,
        });

        const result = await service.uncompleteChecklistItem(
          mockOrganizationId,
          mockItem.id
        );

        expect(result.isCompleted).toBe(false);
        expect(result.completedBy).toBeNull();
      });
    });
  });

  // ===========================================================================
  // Progress Tracking Tests
  // ===========================================================================

  describe('progress tracking', () => {
    describe('getProgress', () => {
      it('should return progress summary', async () => {
        const mockOnboarding = createMockOnboarding({
          status: 'in_progress',
          currentStep: 2,
          completedSteps: 2,
          percentComplete: 40,
        });

        mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);

        const result = await service.getProgress(mockOrganizationId);

        expect(result).not.toBeNull();
        expect(result?.status).toBe('in_progress');
        expect(result?.percentComplete).toBe(40);
        expect(result?.completedSteps).toBe(2);
      });

      it('should return null for non-existent organization', async () => {
        mockRepository.getByOrganizationId.mockResolvedValue(null);

        const result = await service.getProgress('non-existent');

        expect(result).toBeNull();
      });
    });
  });

  // ===========================================================================
  // Event History Tests
  // ===========================================================================

  describe('event history', () => {
    describe('getEvents', () => {
      it('should return onboarding events', async () => {
        const mockOnboarding = createMockOnboarding();
        const mockEvents = [
          {
            id: 'event-1',
            onboardingId: mockOnboardingId,
            eventType: 'STEP_COMPLETED',
            userId: mockUserId,
            eventData: { stepKey: 'welcome' },
            createdAt: new Date(),
          },
        ];

        mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);
        mockRepository.getEvents.mockResolvedValue(mockEvents);

        const result = await service.getEvents(mockOrganizationId);

        expect(result).toHaveLength(1);
        expect(result[0].eventType).toBe('STEP_COMPLETED');
      });

      it('should return empty array for non-existent organization', async () => {
        mockRepository.getByOrganizationId.mockResolvedValue(null);

        const result = await service.getEvents('non-existent');

        expect(result).toEqual([]);
      });
    });
  });

  // ===========================================================================
  // Navigation Tests
  // ===========================================================================

  describe('navigation', () => {
    describe('goToStep', () => {
      it('should update current step and log event', async () => {
        const mockOnboarding = createMockOnboarding();
        const mockStep = createMockStep({
          stepNumber: 1,
          stepKey: 'organization',
        });

        mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);
        mockRepository.getStepByKey.mockResolvedValue(mockStep);
        mockRepository.update.mockResolvedValue({
          ...mockOnboarding,
          currentStep: 1,
        });
        mockRepository.logEvent.mockResolvedValue({});

        const result = await service.goToStep(mockOrganizationId, 'organization', mockUserId);

        expect(result.stepKey).toBe('organization');
        expect(mockRepository.update).toHaveBeenCalledWith(
          mockOnboardingId,
          expect.objectContaining({ currentStep: 1 })
        );
        expect(mockRepository.logEvent).toHaveBeenCalledWith(
          expect.objectContaining({ eventType: 'STEP_NAVIGATED' })
        );
      });

      it('should throw error for non-existent step', async () => {
        const mockOnboarding = createMockOnboarding();

        mockRepository.getByOrganizationId.mockResolvedValue(mockOnboarding);
        mockRepository.getStepByKey.mockResolvedValue(null);

        await expect(
          service.goToStep(mockOrganizationId, 'non_existent', mockUserId)
        ).rejects.toThrow('Step not found');
      });
    });
  });
});
