/**
 * GLAPI Conversational Ledger - Action Executor Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createActionExecutor,
  type MCPClient,
  type ActionRequest,
} from '../action-executor';
import { createDefaultUserContext, type UserContext } from '../guardrails';

describe('Action Executor', () => {
  let mockMcpClient: MCPClient;
  let adminContext: UserContext;
  let viewerContext: UserContext;
  let staffContext: UserContext;

  beforeEach(() => {
    // Create mock MCP client
    mockMcpClient = {
      callTool: vi.fn().mockResolvedValue({ success: true, data: [] }),
    };

    // Create user contexts
    adminContext = createDefaultUserContext('admin-user', 'org-123', 'admin');
    viewerContext = createDefaultUserContext('viewer-user', 'org-123', 'viewer');
    staffContext = createDefaultUserContext('staff-user', 'org-123', 'staff');
  });

  describe('createActionExecutor', () => {
    it('should create executor with all methods', () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      expect(executor.executeAction).toBeDefined();
      expect(executor.confirmAction).toBeDefined();
      expect(executor.cancelAction).toBeDefined();
      expect(executor.getPendingActions).toBeDefined();
      expect(executor.getConversationHistory).toBeDefined();
      expect(executor.addUserMessage).toBeDefined();
      expect(executor.addAssistantMessage).toBeDefined();
      expect(executor.clearConversation).toBeDefined();
      expect(executor.getAvailableActions).toBeDefined();
    });
  });

  describe('executeAction - Permission Checks', () => {
    it('should allow admin to execute any action', async () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      const request: ActionRequest = {
        toolName: 'list_customers',
        parameters: {},
        userMessage: 'Show me all customers',
        conversationId: 'conv-1',
      };

      const result = await executor.executeAction(request, adminContext, 'auth-token');

      expect(result.success).toBe(true);
      expect(result.guardrailResult.allowed).toBe(true);
      expect(mockMcpClient.callTool).toHaveBeenCalledWith(
        'list_customers',
        {},
        'auth-token'
      );
    });

    it('should deny viewer from write operations', async () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      const request: ActionRequest = {
        toolName: 'create_customer',
        parameters: { name: 'Test Customer' },
        userMessage: 'Create a customer',
        conversationId: 'conv-1',
      };

      const result = await executor.executeAction(request, viewerContext, 'auth-token');

      expect(result.success).toBe(false);
      expect(result.guardrailResult.allowed).toBe(false);
      expect(result.guardrailResult.errorCode).toBe('PERMISSION_DENIED');
      expect(mockMcpClient.callTool).not.toHaveBeenCalled();
    });
  });

  describe('executeAction - Confirmation Flow', () => {
    it('should require confirmation for MEDIUM risk actions', async () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      const request: ActionRequest = {
        toolName: 'create_customer',
        parameters: { name: 'Test Customer' },
        userMessage: 'Create a customer',
        conversationId: 'conv-1',
      };

      const result = await executor.executeAction(request, staffContext, 'auth-token');

      expect(result.success).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.confirmationMessage).toBeDefined();
      expect(mockMcpClient.callTool).not.toHaveBeenCalled();

      // Should have created a pending action
      const pendingActions = executor.getPendingActions('conv-1');
      expect(pendingActions.length).toBe(1);
    });

    it('should execute when confirmation provided', async () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      const request: ActionRequest = {
        toolName: 'create_customer',
        parameters: { name: 'Test Customer' },
        userMessage: 'Create a customer',
        conversationId: 'conv-1',
        confirmed: true,
      };

      const result = await executor.executeAction(request, staffContext, 'auth-token');

      expect(result.success).toBe(true);
      expect(result.requiresConfirmation).toBe(false);
      expect(mockMcpClient.callTool).toHaveBeenCalled();
    });
  });

  describe('Pending Actions', () => {
    it('should track pending actions per conversation', async () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      // Create pending action in conv-1
      await executor.executeAction(
        {
          toolName: 'create_customer',
          parameters: { name: 'Customer 1' },
          userMessage: 'Create customer 1',
          conversationId: 'conv-1',
        },
        staffContext,
        'auth-token'
      );

      // Create pending action in conv-2
      await executor.executeAction(
        {
          toolName: 'create_customer',
          parameters: { name: 'Customer 2' },
          userMessage: 'Create customer 2',
          conversationId: 'conv-2',
        },
        staffContext,
        'auth-token'
      );

      expect(executor.getPendingActions('conv-1').length).toBe(1);
      expect(executor.getPendingActions('conv-2').length).toBe(1);
      expect(executor.getPendingActions('conv-3').length).toBe(0);
    });

    it('should confirm pending action', async () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      // Create pending action
      await executor.executeAction(
        {
          toolName: 'create_customer',
          parameters: { name: 'Test Customer' },
          userMessage: 'Create customer',
          conversationId: 'conv-1',
        },
        staffContext,
        'auth-token'
      );

      const pendingActions = executor.getPendingActions('conv-1');
      expect(pendingActions.length).toBe(1);

      const pendingId = pendingActions[0].id;

      // Confirm the pending action
      const result = await executor.confirmAction('conv-1', pendingId, 'auth-token');

      expect(result.success).toBe(true);
      expect(mockMcpClient.callTool).toHaveBeenCalled();

      // Pending action should be removed
      expect(executor.getPendingActions('conv-1').length).toBe(0);
    });

    it('should cancel pending action', async () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      // Create pending action
      await executor.executeAction(
        {
          toolName: 'create_customer',
          parameters: { name: 'Test Customer' },
          userMessage: 'Create customer',
          conversationId: 'conv-1',
        },
        staffContext,
        'auth-token'
      );

      const pendingActions = executor.getPendingActions('conv-1');
      const pendingId = pendingActions[0].id;

      // Cancel the pending action
      const cancelled = executor.cancelAction('conv-1', pendingId);

      expect(cancelled).toBe(true);
      expect(executor.getPendingActions('conv-1').length).toBe(0);
    });

    it('should enforce max pending actions limit', async () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
        maxPendingActions: 2,
      });

      // Create two pending actions
      await executor.executeAction(
        {
          toolName: 'create_customer',
          parameters: { name: 'Customer 1' },
          userMessage: 'Create customer 1',
          conversationId: 'conv-1',
        },
        staffContext,
        'auth-token'
      );

      await executor.executeAction(
        {
          toolName: 'create_customer',
          parameters: { name: 'Customer 2' },
          userMessage: 'Create customer 2',
          conversationId: 'conv-1',
        },
        staffContext,
        'auth-token'
      );

      expect(executor.getPendingActions('conv-1').length).toBe(2);

      // Try to create a third pending action
      const result = await executor.executeAction(
        {
          toolName: 'create_customer',
          parameters: { name: 'Customer 3' },
          userMessage: 'Create customer 3',
          conversationId: 'conv-1',
        },
        staffContext,
        'auth-token'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many pending actions');
      expect(executor.getPendingActions('conv-1').length).toBe(2);
    });

    it('should handle confirming non-existent pending action', async () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      const result = await executor.confirmAction('conv-1', 'non-existent-id', 'auth-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle confirming in non-existent conversation', async () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      const result = await executor.confirmAction('non-existent-conv', 'pending-1', 'auth-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Conversation not found');
    });
  });

  describe('Conversation History', () => {
    it('should track conversation messages', () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      executor.addUserMessage('conv-1', 'Hello', adminContext);
      executor.addAssistantMessage('conv-1', 'Hi there!', adminContext);
      executor.addUserMessage('conv-1', 'Show me customers', adminContext);

      const history = executor.getConversationHistory('conv-1');
      expect(history.length).toBe(3);
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe('Hello');
      expect(history[1].role).toBe('assistant');
      expect(history[2].role).toBe('user');
    });

    it('should add message to history after successful execution', async () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      await executor.executeAction(
        {
          toolName: 'list_customers',
          parameters: {},
          userMessage: 'Show customers',
          conversationId: 'conv-1',
        },
        adminContext,
        'auth-token'
      );

      const history = executor.getConversationHistory('conv-1');
      expect(history.length).toBe(1);
      expect(history[0].role).toBe('assistant');
      expect(history[0].content).toContain('list_customers');
    });

    it('should clear conversation', async () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      executor.addUserMessage('conv-1', 'Hello', adminContext);
      executor.addAssistantMessage('conv-1', 'Hi there!', adminContext);

      expect(executor.getConversationHistory('conv-1').length).toBe(2);

      executor.clearConversation('conv-1');

      expect(executor.getConversationHistory('conv-1').length).toBe(0);
    });
  });

  describe('Available Actions', () => {
    it('should return available actions for admin', () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      const actions = executor.getAvailableActions(adminContext);
      expect(actions.length).toBeGreaterThan(15);

      // Admin should have access to critical actions
      const criticalActions = actions.filter((a) => a.riskLevel === 'CRITICAL');
      expect(criticalActions.length).toBeGreaterThan(0);
    });

    it('should return limited actions for viewer', () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      const actions = executor.getAvailableActions(viewerContext);

      // Viewer should only have read-only actions
      expect(actions.every((a) => a.riskLevel === 'LOW')).toBe(true);
    });

    it('should return actions filtered by permissions', () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      const staffActions = executor.getAvailableActions(staffContext);

      // Staff should have some write actions but not all
      const writeActions = staffActions.filter((a) =>
        a.requiredPermissions.some((p) => p.startsWith('write:'))
      );
      expect(writeActions.length).toBeGreaterThan(0);

      // But not journal entry posting
      const journalPostActions = staffActions.filter((a) =>
        a.requiredPermissions.includes('post:journal_entries')
      );
      expect(journalPostActions.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle MCP client errors gracefully', async () => {
      mockMcpClient.callTool = vi.fn().mockRejectedValue(new Error('Network error'));

      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      const result = await executor.executeAction(
        {
          toolName: 'list_customers',
          parameters: {},
          userMessage: 'Show customers',
          conversationId: 'conv-1',
        },
        adminContext,
        'auth-token'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle non-Error exceptions', async () => {
      mockMcpClient.callTool = vi.fn().mockRejectedValue('String error');

      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      const result = await executor.executeAction(
        {
          toolName: 'list_customers',
          parameters: {},
          userMessage: 'Show customers',
          conversationId: 'conv-1',
        },
        adminContext,
        'auth-token'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('Metadata', () => {
    it('should include execution metadata in result', async () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      const result = await executor.executeAction(
        {
          toolName: 'list_customers',
          parameters: {},
          userMessage: 'Show customers',
          conversationId: 'conv-1',
        },
        adminContext,
        'auth-token'
      );

      expect(result.metadata).toBeDefined();
      expect(result.metadata.timestamp).toBeInstanceOf(Date);
      expect(result.metadata.requestId).toMatch(/^req_/);
      expect(result.metadata.durationMs).toBeDefined();
      expect(result.metadata.isRetry).toBe(false);
    });

    it('should mark confirmed actions as retry', async () => {
      const executor = createActionExecutor({
        mcpClient: mockMcpClient,
        enableLogging: false,
      });

      // Create pending action
      await executor.executeAction(
        {
          toolName: 'create_customer',
          parameters: { name: 'Test' },
          userMessage: 'Create customer',
          conversationId: 'conv-1',
        },
        staffContext,
        'auth-token'
      );

      const pendingActions = executor.getPendingActions('conv-1');
      const pendingId = pendingActions[0].id;

      // Confirm the action
      const result = await executor.confirmAction('conv-1', pendingId, 'auth-token');

      expect(result.metadata.isRetry).toBe(true);
    });
  });
});
