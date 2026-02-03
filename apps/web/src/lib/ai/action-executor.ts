/**
 * GLAPI Conversational Ledger - Action Executor
 *
 * This module provides the action execution layer that:
 * 1. Evaluates guardrails before execution
 * 2. Manages approval flows for high-risk operations
 * 3. Executes MCP tool calls (or generated executor)
 * 4. Handles conversation state and context
 *
 * Now supports the generated tool executor from OpenAPI spec,
 * which provides built-in validation, rate limiting, and caching.
 */

import {
  evaluateGuardrails,
  type UserContext,
  type GuardrailResult,
} from './guardrails';
import {
  type Intent,
  getIntentByMcpTool,
  INTENT_CATALOG,
} from './intents';
import {
  createToolExecutor,
  type ExecutionContext,
  type ExecutionResult,
} from './generated';

// ============================================================================
// Types
// ============================================================================

/**
 * Action execution request
 */
export interface ActionRequest {
  /** MCP tool name to execute */
  toolName: string;
  /** Parameters for the tool */
  parameters: Record<string, unknown>;
  /** Original user message */
  userMessage: string;
  /** Conversation ID for state tracking */
  conversationId: string;
  /** Whether user has confirmed the action */
  confirmed?: boolean;
}

/**
 * Action execution result
 */
export interface ActionResult {
  /** Whether the action was successful */
  success: boolean;
  /** Result data (if successful) */
  data?: unknown;
  /** Error message (if failed) */
  error?: string;
  /** Whether confirmation is required */
  requiresConfirmation: boolean;
  /** Confirmation message to show user */
  confirmationMessage?: string;
  /** The evaluated intent */
  intent?: Intent;
  /** Guardrail evaluation result */
  guardrailResult: GuardrailResult;
  /** Execution metadata */
  metadata: ActionMetadata;
  /** Whether dry-run preview is supported */
  supportsDryRun?: boolean;
  /** Dry-run preview result (if executed with dryRun=true) */
  dryRunResult?: unknown;
}

/**
 * Action execution metadata
 */
export interface ActionMetadata {
  /** Execution timestamp */
  timestamp: Date;
  /** Execution duration in ms */
  durationMs?: number;
  /** Request ID for tracing */
  requestId: string;
  /** Whether the action was from a retry */
  isRetry: boolean;
}

/**
 * Pending action awaiting confirmation
 */
export interface PendingAction {
  /** Unique pending action ID */
  id: string;
  /** Original action request */
  request: ActionRequest;
  /** User context */
  userContext: UserContext;
  /** Guardrail result */
  guardrailResult: GuardrailResult;
  /** When the pending action was created */
  createdAt: Date;
  /** When the pending action expires */
  expiresAt: Date;
}

/**
 * Conversation state for multi-turn interactions
 */
export interface ConversationState {
  /** Conversation ID */
  id: string;
  /** User context */
  userContext: UserContext;
  /** Pending actions awaiting confirmation */
  pendingActions: Map<string, PendingAction>;
  /** Message history (for context) */
  messages: ConversationMessage[];
  /** Created timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
}

/**
 * Conversation message
 */
export interface ConversationMessage {
  /** Message ID */
  id: string;
  /** Role (user or assistant) */
  role: 'user' | 'assistant' | 'system';
  /** Message content */
  content: string;
  /** Timestamp */
  timestamp: Date;
  /** Associated action (if any) */
  actionId?: string;
}

/**
 * MCP client interface for tool execution
 */
export interface MCPClient {
  /** Execute a tool call */
  callTool(
    toolName: string,
    parameters: Record<string, unknown>,
    authToken: string
  ): Promise<unknown>;
}

// ============================================================================
// Action Executor
// ============================================================================

/**
 * Action executor configuration
 */
export interface ActionExecutorConfig {
  /** MCP client for tool execution (legacy) */
  mcpClient: MCPClient;
  /** Use generated tool executor instead of MCP client */
  useGeneratedExecutor?: boolean;
  /** tRPC caller for generated executor (required if useGeneratedExecutor is true) */
  trpcCaller?: unknown;
  /** Pending action timeout in ms (default: 5 minutes) */
  pendingActionTimeoutMs?: number;
  /** Maximum pending actions per conversation */
  maxPendingActions?: number;
  /** Enable execution logging */
  enableLogging?: boolean;
  /** Custom logger */
  logger?: (message: string, data?: unknown) => void;
}

/**
 * Create an action executor
 */
export function createActionExecutor(config: ActionExecutorConfig) {
  const {
    mcpClient,
    useGeneratedExecutor = false,
    trpcCaller,
    pendingActionTimeoutMs = 5 * 60 * 1000, // 5 minutes
    maxPendingActions = 5,
    enableLogging = true,
    logger = defaultLogger,
  } = config;

  // Create generated tool executor if enabled
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generatedExecutor = useGeneratedExecutor && trpcCaller
    ? createToolExecutor({ trpcCaller: trpcCaller as any })
    : null;

  // Conversation state store (in production, use Redis or similar)
  const conversationStore = new Map<string, ConversationState>();

  /**
   * Get or create conversation state
   */
  function getConversation(
    conversationId: string,
    userContext: UserContext
  ): ConversationState {
    let conversation = conversationStore.get(conversationId);

    if (!conversation) {
      conversation = {
        id: conversationId,
        userContext,
        pendingActions: new Map(),
        messages: [],
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };
      conversationStore.set(conversationId, conversation);
    }

    conversation.lastActivityAt = new Date();
    return conversation;
  }

  /**
   * Clean up expired pending actions
   */
  function cleanupExpiredActions(conversation: ConversationState): void {
    const now = new Date();
    for (const [id, action] of conversation.pendingActions) {
      if (action.expiresAt < now) {
        conversation.pendingActions.delete(id);
        if (enableLogging) {
          logger(`Pending action expired: ${id}`);
        }
      }
    }
  }

  /**
   * Execute an action with guardrail evaluation
   */
  async function executeAction(
    request: ActionRequest,
    userContext: UserContext,
    authToken: string
  ): Promise<ActionResult> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    const metadata: ActionMetadata = {
      timestamp: new Date(),
      requestId,
      isRetry: false,
    };

    if (enableLogging) {
      logger(`[${requestId}] Executing action: ${request.toolName}`, {
        conversationId: request.conversationId,
        userId: userContext.userId,
      });
    }

    // Get conversation state
    const conversation = getConversation(request.conversationId, userContext);
    cleanupExpiredActions(conversation);

    // Evaluate guardrails
    const guardrailResult = evaluateGuardrails(
      request.toolName,
      request.parameters,
      userContext,
      request.userMessage
    );

    // If not allowed, return immediately
    if (!guardrailResult.allowed) {
      if (enableLogging) {
        logger(`[${requestId}] Action blocked: ${guardrailResult.reason}`);
      }

      return {
        success: false,
        error: guardrailResult.reason,
        requiresConfirmation: false,
        guardrailResult,
        metadata: {
          ...metadata,
          durationMs: Date.now() - startTime,
        },
      };
    }

    // If confirmation required and not confirmed
    if (guardrailResult.requiresConfirmation && !request.confirmed) {
      // Check if we already have too many pending actions
      if (conversation.pendingActions.size >= maxPendingActions) {
        return {
          success: false,
          error: 'Too many pending actions. Please confirm or cancel existing actions first.',
          requiresConfirmation: false,
          guardrailResult,
          metadata: {
            ...metadata,
            durationMs: Date.now() - startTime,
          },
        };
      }

      // Create pending action
      const pendingId = `pending_${requestId}`;
      const pendingAction: PendingAction = {
        id: pendingId,
        request,
        userContext,
        guardrailResult,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + pendingActionTimeoutMs),
      };

      conversation.pendingActions.set(pendingId, pendingAction);

      if (enableLogging) {
        logger(`[${requestId}] Action requires confirmation, created pending: ${pendingId}`);
      }

      return {
        success: false,
        requiresConfirmation: true,
        confirmationMessage: guardrailResult.confirmationMessage,
        intent: guardrailResult.intent,
        guardrailResult,
        metadata: {
          ...metadata,
          durationMs: Date.now() - startTime,
        },
      };
    }

    // Execute the action using generated executor or MCP client
    try {
      let result: unknown;

      if (generatedExecutor) {
        // Use generated executor with built-in validation, rate limiting, caching
        if (enableLogging) {
          logger(`[${requestId}] Executing via generated executor: ${request.toolName}`);
        }

        const executionContext: ExecutionContext = {
          userId: userContext.userId,
          organizationId: userContext.organizationId,
          userRole: userContext.role,
          authToken,
        };

        const execResult = await generatedExecutor.executeTool(
          request.toolName,
          request.parameters,
          executionContext
        );

        if (!execResult.success) {
          const errorMsg = execResult.error?.message || 'Tool execution failed';
          throw new Error(errorMsg);
        }

        result = execResult.data;
      } else {
        // Fall back to MCP client
        if (enableLogging) {
          logger(`[${requestId}] Executing MCP tool: ${request.toolName}`);
        }

        result = await mcpClient.callTool(
          request.toolName,
          request.parameters,
          authToken
        );
      }

      // Add message to conversation history
      conversation.messages.push({
        id: `msg_${requestId}`,
        role: 'assistant',
        content: `Executed ${request.toolName} successfully`,
        timestamp: new Date(),
        actionId: requestId,
      });

      if (enableLogging) {
        logger(`[${requestId}] Action completed successfully`);
      }

      return {
        success: true,
        data: result,
        requiresConfirmation: false,
        intent: guardrailResult.intent,
        guardrailResult,
        supportsDryRun: guardrailResult.supportsDryRun,
        metadata: {
          ...metadata,
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (enableLogging) {
        logger(`[${requestId}] Action failed: ${errorMessage}`);
      }

      return {
        success: false,
        error: errorMessage,
        requiresConfirmation: false,
        intent: guardrailResult.intent,
        guardrailResult,
        supportsDryRun: guardrailResult.supportsDryRun,
        metadata: {
          ...metadata,
          durationMs: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Confirm a pending action
   */
  async function confirmAction(
    conversationId: string,
    pendingActionId: string,
    authToken: string
  ): Promise<ActionResult> {
    const conversation = conversationStore.get(conversationId);

    if (!conversation) {
      return {
        success: false,
        error: 'Conversation not found',
        requiresConfirmation: false,
        guardrailResult: {
          allowed: false,
          reason: 'Conversation not found',
          requiresConfirmation: false,
          warnings: [],
        },
        metadata: {
          timestamp: new Date(),
          requestId: generateRequestId(),
          isRetry: false,
        },
      };
    }

    const pendingAction = conversation.pendingActions.get(pendingActionId);

    if (!pendingAction) {
      return {
        success: false,
        error: 'Pending action not found or expired',
        requiresConfirmation: false,
        guardrailResult: {
          allowed: false,
          reason: 'Pending action not found or expired',
          requiresConfirmation: false,
          warnings: [],
        },
        metadata: {
          timestamp: new Date(),
          requestId: generateRequestId(),
          isRetry: false,
        },
      };
    }

    // Check if expired
    if (pendingAction.expiresAt < new Date()) {
      conversation.pendingActions.delete(pendingActionId);
      return {
        success: false,
        error: 'Pending action has expired. Please try again.',
        requiresConfirmation: false,
        guardrailResult: pendingAction.guardrailResult,
        metadata: {
          timestamp: new Date(),
          requestId: generateRequestId(),
          isRetry: false,
        },
      };
    }

    // Remove from pending
    conversation.pendingActions.delete(pendingActionId);

    // Execute with confirmation flag
    const confirmedRequest: ActionRequest = {
      ...pendingAction.request,
      confirmed: true,
    };

    const result = await executeAction(
      confirmedRequest,
      pendingAction.userContext,
      authToken
    );

    return {
      ...result,
      metadata: {
        ...result.metadata,
        isRetry: true,
      },
    };
  }

  /**
   * Cancel a pending action
   */
  function cancelAction(
    conversationId: string,
    pendingActionId: string
  ): boolean {
    const conversation = conversationStore.get(conversationId);

    if (!conversation) {
      return false;
    }

    const deleted = conversation.pendingActions.delete(pendingActionId);

    if (deleted && enableLogging) {
      logger(`Pending action cancelled: ${pendingActionId}`);
    }

    return deleted;
  }

  /**
   * Get pending actions for a conversation
   */
  function getPendingActions(conversationId: string): PendingAction[] {
    const conversation = conversationStore.get(conversationId);

    if (!conversation) {
      return [];
    }

    cleanupExpiredActions(conversation);
    return Array.from(conversation.pendingActions.values());
  }

  /**
   * Get conversation history
   */
  function getConversationHistory(conversationId: string): ConversationMessage[] {
    const conversation = conversationStore.get(conversationId);
    return conversation?.messages || [];
  }

  /**
   * Add a user message to conversation history
   */
  function addUserMessage(conversationId: string, content: string, userContext: UserContext): void {
    const conversation = getConversation(conversationId, userContext);
    conversation.messages.push({
      id: `msg_${generateRequestId()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    });
  }

  /**
   * Add an assistant message to conversation history
   */
  function addAssistantMessage(conversationId: string, content: string, userContext: UserContext, actionId?: string): void {
    const conversation = getConversation(conversationId, userContext);
    conversation.messages.push({
      id: `msg_${generateRequestId()}`,
      role: 'assistant',
      content,
      timestamp: new Date(),
      actionId,
    });
  }

  /**
   * Clear conversation state
   */
  function clearConversation(conversationId: string): void {
    conversationStore.delete(conversationId);
    if (enableLogging) {
      logger(`Conversation cleared: ${conversationId}`);
    }
  }

  /**
   * Get available actions for the user's role
   */
  function getAvailableActions(userContext: UserContext): Intent[] {
    return Object.values(INTENT_CATALOG).filter((intent) => {
      // Check if user has required permissions
      const hasPermissions = intent.requiredPermissions.every((perm) =>
        userContext.permissions.includes(perm)
      );
      return intent.enabled && hasPermissions;
    });
  }

  return {
    executeAction,
    confirmAction,
    cancelAction,
    getPendingActions,
    getConversationHistory,
    addUserMessage,
    addAssistantMessage,
    clearConversation,
    getAvailableActions,
    getConversation,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Default logger
 */
function defaultLogger(message: string, data?: unknown): void {
  if (data) {
    console.log(`[Action Executor] ${message}`, data);
  } else {
    console.log(`[Action Executor] ${message}`);
  }
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Exports
// ============================================================================

export type ActionExecutor = ReturnType<typeof createActionExecutor>;
