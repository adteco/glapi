import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceError } from '../../types';

// Use vi.hoisted() to properly hoist mock functions for use in vi.mock factory
const {
  mockFindDefinitionById,
  mockFindDefinitionWithSteps,
  mockFindLatestDefinitionByCode,
  mockFindFirstStep,
  mockCreateInstance,
  mockFindInstanceById,
  mockUpdateInstance,
  mockCreateStepExecution,
  mockUpdateStepExecution,
  mockFindStepExecutionsByInstanceId,
  mockFindActiveSubscriptionsForEvent,
  mockIncrementSubscriptionTrigger,
  mockFindWebhookByKey,
  mockIncrementWebhookInvocation,
  mockEmit,
} = vi.hoisted(() => ({
  mockFindDefinitionById: vi.fn(),
  mockFindDefinitionWithSteps: vi.fn(),
  mockFindLatestDefinitionByCode: vi.fn(),
  mockFindFirstStep: vi.fn(),
  mockCreateInstance: vi.fn(),
  mockFindInstanceById: vi.fn(),
  mockUpdateInstance: vi.fn(),
  mockCreateStepExecution: vi.fn(),
  mockUpdateStepExecution: vi.fn(),
  mockFindStepExecutionsByInstanceId: vi.fn(),
  mockFindActiveSubscriptionsForEvent: vi.fn(),
  mockIncrementSubscriptionTrigger: vi.fn(),
  mockFindWebhookByKey: vi.fn(),
  mockIncrementWebhookInvocation: vi.fn(),
  mockEmit: vi.fn(),
}));

// Mock the database module
vi.mock('@glapi/database', () => ({
  workflowAutomationRepository: {
    findDefinitionById: mockFindDefinitionById,
    findDefinitionWithSteps: mockFindDefinitionWithSteps,
    findLatestDefinitionByCode: mockFindLatestDefinitionByCode,
    findFirstStep: mockFindFirstStep,
    createInstance: mockCreateInstance,
    findInstanceById: mockFindInstanceById,
    updateInstance: mockUpdateInstance,
    createStepExecution: mockCreateStepExecution,
    updateStepExecution: mockUpdateStepExecution,
    findStepExecutionsByInstanceId: mockFindStepExecutionsByInstanceId,
    findActiveSubscriptionsForEvent: mockFindActiveSubscriptionsForEvent,
    incrementSubscriptionTrigger: mockIncrementSubscriptionTrigger,
    findWebhookByKey: mockFindWebhookByKey,
    incrementWebhookInvocation: mockIncrementWebhookInvocation,
  },
}));

// Mock EventService
vi.mock('../event-service', () => ({
  EventService: vi.fn().mockImplementation(() => ({
    emit: mockEmit,
  })),
  createEventService: vi.fn().mockImplementation(() => ({
    emit: mockEmit,
  })),
}));

// Import after mocking
import {
  WorkflowExecutionService,
  createWorkflowExecutionService,
  StartWorkflowInput,
} from '../workflow-execution-service';
import { EventCategory } from '../../types/events.types';

describe('WorkflowExecutionService', () => {
  const organizationId = 'org-123';
  const userId = 'user-456';
  let service: WorkflowExecutionService;

  // Test data
  const mockDefinition = {
    id: 'def-001',
    organizationId,
    name: 'Test Workflow',
    workflowCode: 'TEST_WORKFLOW',
    version: 1,
    isLatestVersion: true,
    status: 'active',
    triggerType: 'event',
    triggerConfig: {
      eventType: 'document.created',
    },
    maxRetries: 3,
    retryDelayMs: 1000,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSteps = [
    {
      id: 'step-001',
      workflowDefinitionId: 'def-001',
      stepCode: 'STEP_1',
      stepName: 'First Step',
      stepOrder: 0,
      actionType: 'notification',
      actionConfig: {
        channels: ['email'],
        subjectTemplate: 'Test Subject',
        bodyTemplate: 'Test Body',
      },
      errorStrategy: 'stop',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'step-002',
      workflowDefinitionId: 'def-001',
      stepCode: 'STEP_2',
      stepName: 'Second Step',
      stepOrder: 1,
      actionType: 'internal_action',
      actionConfig: {
        actionName: 'logMessage',
        parameters: { message: 'Step 2 executed' },
      },
      errorStrategy: 'continue',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockDefinitionWithSteps = {
    ...mockDefinition,
    steps: mockSteps,
  };

  const mockInstance = {
    id: 'inst-001',
    organizationId,
    workflowDefinitionId: 'def-001',
    definitionSnapshot: mockDefinitionWithSteps,
    status: 'pending',
    currentStepId: 'step-001',
    currentStepOrder: 0,
    triggeredBy: 'event',
    triggerContext: {},
    executionContext: {},
    retryCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = createWorkflowExecutionService(organizationId, userId);
  });

  describe('startWorkflow', () => {
    it('should start a workflow by definition ID', async () => {
      mockFindDefinitionWithSteps.mockResolvedValue(mockDefinitionWithSteps);
      mockFindFirstStep.mockResolvedValue(mockSteps[0]);
      mockCreateInstance.mockResolvedValue(mockInstance);
      mockEmit.mockResolvedValue(undefined);

      const input: StartWorkflowInput = {
        workflowDefinitionId: 'def-001',
        triggerType: 'manual',
        triggerContext: { foo: 'bar' },
      };

      const result = await service.startWorkflow(input);

      expect(result.instance).toEqual(mockInstance);
      expect(result.definition).toEqual(mockDefinitionWithSteps);
      expect(mockCreateInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          workflowDefinitionId: 'def-001',
          triggeredBy: 'manual',
        })
      );
      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'WorkflowStarted',
          aggregateId: mockInstance.id,
        })
      );
    });

    it('should start a workflow by workflow code', async () => {
      mockFindLatestDefinitionByCode.mockResolvedValue(mockDefinitionWithSteps);
      mockFindFirstStep.mockResolvedValue(mockSteps[0]);
      mockCreateInstance.mockResolvedValue(mockInstance);
      mockEmit.mockResolvedValue(undefined);

      const input: StartWorkflowInput = {
        workflowCode: 'TEST_WORKFLOW',
        triggerType: 'api',
      };

      const result = await service.startWorkflow(input);

      expect(mockFindLatestDefinitionByCode).toHaveBeenCalledWith(organizationId, 'TEST_WORKFLOW');
      expect(result.instance).toBeDefined();
    });

    it('should throw error if workflow not found', async () => {
      mockFindDefinitionWithSteps.mockResolvedValue(null);

      const input: StartWorkflowInput = {
        workflowDefinitionId: 'non-existent',
        triggerType: 'manual',
      };

      await expect(service.startWorkflow(input)).rejects.toThrow(ServiceError);
      await expect(service.startWorkflow(input)).rejects.toThrow('Workflow definition not found');
    });

    it('should throw error if workflow not active', async () => {
      mockFindDefinitionWithSteps.mockResolvedValue({
        ...mockDefinitionWithSteps,
        status: 'draft',
      });

      const input: StartWorkflowInput = {
        workflowDefinitionId: 'def-001',
        triggerType: 'manual',
      };

      await expect(service.startWorkflow(input)).rejects.toThrow(ServiceError);
      await expect(service.startWorkflow(input)).rejects.toThrow('not active');
    });

    it('should throw error without organization context', async () => {
      const serviceWithoutOrg = createWorkflowExecutionService(undefined, userId);

      const input: StartWorkflowInput = {
        workflowDefinitionId: 'def-001',
        triggerType: 'manual',
      };

      await expect(serviceWithoutOrg.startWorkflow(input)).rejects.toThrow(ServiceError);
      await expect(serviceWithoutOrg.startWorkflow(input)).rejects.toThrow('Organization context is required');
    });
  });

  describe('executeWorkflow', () => {
    it('should execute all steps in a workflow', async () => {
      const runningInstance = { ...mockInstance, status: 'running', startedAt: new Date() };
      const completedInstance = { ...runningInstance, status: 'completed', completedAt: new Date() };

      mockFindInstanceById.mockResolvedValue(mockInstance);
      mockUpdateInstance
        .mockResolvedValueOnce(runningInstance) // status -> running
        .mockResolvedValueOnce({ ...runningInstance, currentStepOrder: 1 }) // after step 1
        .mockResolvedValueOnce({ ...runningInstance, currentStepOrder: 2 }) // after step 2
        .mockResolvedValueOnce(completedInstance); // status -> completed
      mockCreateStepExecution.mockResolvedValue({ id: 'exec-001' });
      mockUpdateStepExecution.mockResolvedValue({});
      mockEmit.mockResolvedValue(undefined);

      const result = await service.executeWorkflow('inst-001');

      expect(result.status).toBe('completed');
      expect(mockCreateStepExecution).toHaveBeenCalledTimes(2); // Two steps
      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'WorkflowCompleted',
        })
      );
    });

    it('should return early if workflow already completed', async () => {
      const completedInstance = { ...mockInstance, status: 'completed' };
      mockFindInstanceById.mockResolvedValue(completedInstance);

      const result = await service.executeWorkflow('inst-001');

      expect(result.status).toBe('completed');
      expect(mockUpdateInstance).not.toHaveBeenCalled();
    });

    it('should handle step failure with stop strategy', async () => {
      const failingSteps = [
        {
          ...mockSteps[0],
          actionType: 'internal_action',
          actionConfig: {
            actionName: 'unknownAction', // This will fail
          },
          errorStrategy: 'stop',
        },
      ];
      const failingDefinition = {
        ...mockDefinition,
        steps: failingSteps,
      };
      const instanceWithFailingDef = {
        ...mockInstance,
        definitionSnapshot: failingDefinition,
      };

      mockFindInstanceById.mockResolvedValue(instanceWithFailingDef);
      mockUpdateInstance
        .mockResolvedValueOnce({ ...instanceWithFailingDef, status: 'running' })
        .mockResolvedValueOnce({ ...instanceWithFailingDef, status: 'failed' });
      mockCreateStepExecution.mockResolvedValue({ id: 'exec-001' });
      mockUpdateStepExecution.mockResolvedValue({});
      mockEmit.mockResolvedValue(undefined);

      const result = await service.executeWorkflow('inst-001');

      expect(result.status).toBe('failed');
      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'WorkflowFailed',
        })
      );
    });

    it('should continue on step failure with continue strategy', async () => {
      const stepsWithContinue = [
        {
          ...mockSteps[0],
          actionType: 'internal_action',
          actionConfig: { actionName: 'unknownAction' },
          errorStrategy: 'continue',
        },
        mockSteps[1],
      ];
      const defWithContinue = { ...mockDefinition, steps: stepsWithContinue };
      const instanceWithContinue = { ...mockInstance, definitionSnapshot: defWithContinue };

      mockFindInstanceById.mockResolvedValue(instanceWithContinue);
      mockUpdateInstance
        .mockResolvedValueOnce({ ...instanceWithContinue, status: 'running' })
        .mockResolvedValueOnce({ ...instanceWithContinue, currentStepOrder: 1 })
        .mockResolvedValueOnce({ ...instanceWithContinue, currentStepOrder: 2 })
        .mockResolvedValueOnce({ ...instanceWithContinue, status: 'completed' });
      mockCreateStepExecution.mockResolvedValue({ id: 'exec-001' });
      mockUpdateStepExecution.mockResolvedValue({});
      mockEmit.mockResolvedValue(undefined);

      const result = await service.executeWorkflow('inst-001');

      expect(result.status).toBe('completed');
      expect(mockCreateStepExecution).toHaveBeenCalledTimes(2);
    });
  });

  describe('cancelWorkflow', () => {
    it('should cancel a running workflow', async () => {
      const runningInstance = { ...mockInstance, status: 'running' };
      const cancelledInstance = { ...runningInstance, status: 'cancelled' };

      mockFindInstanceById.mockResolvedValue(runningInstance);
      mockUpdateInstance.mockResolvedValue(cancelledInstance);
      mockEmit.mockResolvedValue(undefined);

      const result = await service.cancelWorkflow('inst-001', 'User requested cancellation');

      expect(result.status).toBe('cancelled');
      expect(mockUpdateInstance).toHaveBeenCalledWith(
        'inst-001',
        expect.objectContaining({
          status: 'cancelled',
          errorMessage: 'User requested cancellation',
        })
      );
    });

    it('should not cancel already completed workflow', async () => {
      const completedInstance = { ...mockInstance, status: 'completed' };
      mockFindInstanceById.mockResolvedValue(completedInstance);

      await expect(service.cancelWorkflow('inst-001')).rejects.toThrow(ServiceError);
      await expect(service.cancelWorkflow('inst-001')).rejects.toThrow('Cannot cancel workflow');
    });
  });

  describe('retryWorkflow', () => {
    it('should retry a failed workflow', async () => {
      const failedInstance = { ...mockInstance, status: 'failed', retryCount: 1 };
      const retriedInstance = { ...failedInstance, status: 'pending', retryCount: 2 };
      const completedInstance = { ...retriedInstance, status: 'completed' };

      mockFindInstanceById
        .mockResolvedValueOnce(failedInstance)
        .mockResolvedValueOnce(retriedInstance);
      mockUpdateInstance
        .mockResolvedValueOnce(retriedInstance) // Reset status
        .mockResolvedValueOnce({ ...retriedInstance, status: 'running' })
        .mockResolvedValueOnce({ ...retriedInstance, currentStepOrder: 1 })
        .mockResolvedValueOnce({ ...retriedInstance, currentStepOrder: 2 })
        .mockResolvedValueOnce(completedInstance);
      mockCreateStepExecution.mockResolvedValue({ id: 'exec-001' });
      mockUpdateStepExecution.mockResolvedValue({});
      mockEmit.mockResolvedValue(undefined);

      const result = await service.retryWorkflow('inst-001');

      expect(mockUpdateInstance).toHaveBeenCalledWith(
        'inst-001',
        expect.objectContaining({
          status: 'pending',
          retryCount: 2,
        })
      );
    });

    it('should not retry if max retries exceeded', async () => {
      const failedInstance = {
        ...mockInstance,
        status: 'failed',
        retryCount: 3,
        definitionSnapshot: { ...mockDefinitionWithSteps, maxRetries: 3 },
      };
      mockFindInstanceById.mockResolvedValue(failedInstance);

      await expect(service.retryWorkflow('inst-001')).rejects.toThrow(ServiceError);
      await expect(service.retryWorkflow('inst-001')).rejects.toThrow('Maximum retries');
    });
  });

  describe('handleEventTrigger', () => {
    it('should trigger workflows for matching event subscriptions', async () => {
      const subscription = {
        id: 'sub-001',
        organizationId,
        workflowDefinitionId: 'def-001',
        eventType: 'document.created',
        documentTypes: ['invoice'],
        conditions: null,
        isActive: true,
      };

      mockFindActiveSubscriptionsForEvent.mockResolvedValue([subscription]);
      mockFindDefinitionWithSteps.mockResolvedValue(mockDefinitionWithSteps);
      mockFindFirstStep.mockResolvedValue(mockSteps[0]);
      mockCreateInstance.mockResolvedValue(mockInstance);
      mockFindInstanceById.mockResolvedValue(mockInstance);
      mockUpdateInstance.mockResolvedValue({ ...mockInstance, status: 'completed' });
      mockIncrementSubscriptionTrigger.mockResolvedValue(undefined);
      mockCreateStepExecution.mockResolvedValue({ id: 'exec-001' });
      mockUpdateStepExecution.mockResolvedValue({});
      mockEmit.mockResolvedValue(undefined);

      const instances = await service.handleEventTrigger(
        'document.created',
        { documentId: 'doc-123' },
        'invoice',
        'doc-123'
      );

      expect(instances.length).toBe(1);
      expect(mockFindActiveSubscriptionsForEvent).toHaveBeenCalledWith(organizationId, 'document.created');
      expect(mockIncrementSubscriptionTrigger).toHaveBeenCalledWith('sub-001');
    });

    it('should filter by document type', async () => {
      const subscription = {
        id: 'sub-001',
        organizationId,
        workflowDefinitionId: 'def-001',
        eventType: 'document.created',
        documentTypes: ['invoice'], // Only invoices
        conditions: null,
        isActive: true,
      };

      mockFindActiveSubscriptionsForEvent.mockResolvedValue([subscription]);

      const instances = await service.handleEventTrigger(
        'document.created',
        { documentId: 'doc-123' },
        'purchase_order', // Not an invoice
        'doc-123'
      );

      expect(instances.length).toBe(0);
      expect(mockCreateInstance).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhookTrigger', () => {
    it('should trigger workflow from webhook', async () => {
      const webhook = {
        id: 'webhook-001',
        organizationId,
        workflowDefinitionId: 'def-001',
        webhookKey: 'test-key-123',
        isActive: true,
        expiresAt: null,
      };

      mockFindWebhookByKey.mockResolvedValue(webhook);
      mockFindDefinitionWithSteps.mockResolvedValue(mockDefinitionWithSteps);
      mockFindFirstStep.mockResolvedValue(mockSteps[0]);
      mockCreateInstance.mockResolvedValue(mockInstance);
      mockFindInstanceById.mockResolvedValue(mockInstance);
      mockUpdateInstance.mockResolvedValue({ ...mockInstance, status: 'completed' });
      mockIncrementWebhookInvocation.mockResolvedValue(undefined);
      mockCreateStepExecution.mockResolvedValue({ id: 'exec-001' });
      mockUpdateStepExecution.mockResolvedValue({});
      mockEmit.mockResolvedValue(undefined);

      const result = await service.handleWebhookTrigger('test-key-123', { data: 'payload' });

      expect(result).toBeDefined();
      expect(mockIncrementWebhookInvocation).toHaveBeenCalledWith('webhook-001');
    });

    it('should reject inactive webhook', async () => {
      const webhook = {
        id: 'webhook-001',
        organizationId,
        workflowDefinitionId: 'def-001',
        webhookKey: 'test-key-123',
        isActive: false,
      };

      mockFindWebhookByKey.mockResolvedValue(webhook);

      await expect(
        service.handleWebhookTrigger('test-key-123', {})
      ).rejects.toThrow(ServiceError);
    });

    it('should reject expired webhook', async () => {
      const webhook = {
        id: 'webhook-001',
        organizationId,
        workflowDefinitionId: 'def-001',
        webhookKey: 'test-key-123',
        isActive: true,
        expiresAt: new Date('2020-01-01'), // Expired
      };

      mockFindWebhookByKey.mockResolvedValue(webhook);

      await expect(
        service.handleWebhookTrigger('test-key-123', {})
      ).rejects.toThrow('expired');
    });
  });

  describe('Action Executors', () => {
    describe('NotificationActionExecutor', () => {
      it('should process notification with template variables', async () => {
        const notificationSteps = [
          {
            ...mockSteps[0],
            actionConfig: {
              channels: ['email'],
              subjectTemplate: 'Hello {{customer.name}}',
              bodyTemplate: 'Your order {{order.id}} is ready',
            },
          },
        ];
        const defWithNotification = { ...mockDefinition, steps: notificationSteps };
        const instanceWithNotification = {
          ...mockInstance,
          definitionSnapshot: defWithNotification,
          executionContext: {
            customer: { name: 'John Doe' },
            order: { id: 'ORD-123' },
          },
        };

        mockFindInstanceById.mockResolvedValue(instanceWithNotification);
        mockUpdateInstance.mockResolvedValue({ ...instanceWithNotification, status: 'completed' });
        mockCreateStepExecution.mockResolvedValue({ id: 'exec-001' });
        mockUpdateStepExecution.mockResolvedValue({});
        mockEmit.mockResolvedValue(undefined);

        const result = await service.executeWorkflow('inst-001');

        expect(result.status).toBe('completed');
        expect(mockUpdateStepExecution).toHaveBeenCalledWith(
          'exec-001',
          expect.objectContaining({
            status: 'completed',
            outputData: expect.objectContaining({
              notificationSent: true,
            }),
          })
        );
      });
    });

    describe('ConditionActionExecutor', () => {
      it('should branch based on condition', async () => {
        const conditionSteps = [
          {
            id: 'step-condition',
            workflowDefinitionId: 'def-001',
            stepCode: 'CHECK_AMOUNT',
            stepName: 'Check Amount',
            stepOrder: 0,
            actionType: 'condition',
            actionConfig: {
              conditions: [
                {
                  condition: [
                    { field: 'amount', operator: 'gte', value: 1000 },
                  ],
                  branchName: 'high_value',
                  nextStepId: 'step-high',
                },
              ],
              defaultBranchName: 'low_value',
              defaultNextStepId: 'step-low',
            },
            errorStrategy: 'stop',
          },
          {
            id: 'step-high',
            workflowDefinitionId: 'def-001',
            stepCode: 'HIGH_VALUE',
            stepName: 'High Value Handler',
            stepOrder: 1,
            actionType: 'notification',
            actionConfig: { channels: ['email'], bodyTemplate: 'High value!' },
            errorStrategy: 'stop',
          },
        ];
        const defWithCondition = { ...mockDefinition, steps: conditionSteps };
        const instanceWithCondition = {
          ...mockInstance,
          definitionSnapshot: defWithCondition,
          executionContext: { amount: 1500 }, // High value
        };

        mockFindInstanceById.mockResolvedValue(instanceWithCondition);
        mockUpdateInstance.mockResolvedValue({ ...instanceWithCondition, status: 'completed' });
        mockCreateStepExecution.mockResolvedValue({ id: 'exec-001' });
        mockUpdateStepExecution.mockResolvedValue({});
        mockEmit.mockResolvedValue(undefined);

        const result = await service.executeWorkflow('inst-001');

        expect(result.status).toBe('completed');
        // Should have processed the condition step and then the high value step
        expect(mockCreateStepExecution).toHaveBeenCalledTimes(2);
      });
    });

    describe('TransformActionExecutor', () => {
      it('should transform data between steps', async () => {
        const transformSteps = [
          {
            id: 'step-transform',
            workflowDefinitionId: 'def-001',
            stepCode: 'TRANSFORM',
            stepName: 'Transform Data',
            stepOrder: 0,
            actionType: 'transform',
            actionConfig: {
              transformations: [
                { source: 'input.name', target: 'output.customerName', transform: 'uppercase' },
                { source: 'input.amount', target: 'output.totalAmount', transform: 'number' },
              ],
            },
            errorStrategy: 'stop',
          },
        ];
        const defWithTransform = { ...mockDefinition, steps: transformSteps };
        const instanceWithTransform = {
          ...mockInstance,
          definitionSnapshot: defWithTransform,
          executionContext: {
            input: { name: 'john doe', amount: '123.45' },
          },
        };

        mockFindInstanceById.mockResolvedValue(instanceWithTransform);
        mockUpdateInstance.mockResolvedValue({ ...instanceWithTransform, status: 'completed' });
        mockCreateStepExecution.mockResolvedValue({ id: 'exec-001' });
        mockUpdateStepExecution.mockResolvedValue({});
        mockEmit.mockResolvedValue(undefined);

        const result = await service.executeWorkflow('inst-001');

        expect(result.status).toBe('completed');
        expect(mockUpdateStepExecution).toHaveBeenCalledWith(
          'exec-001',
          expect.objectContaining({
            outputData: expect.objectContaining({
              output: expect.objectContaining({
                customerName: 'JOHN DOE',
                totalAmount: 123.45,
              }),
            }),
          })
        );
      });
    });
  });
});
