/**
 * GLAPI Conversational Ledger - Conversational Service
 *
 * This module provides the main conversational AI service that:
 * 1. Processes natural language messages
 * 2. Maps to intents via LLM
 * 3. Enforces guardrails and approvals
 * 4. Executes actions and returns responses
 *
 * Now uses generated AI tools from OpenAPI spec for tool declarations.
 */

import OpenAI from 'openai';
import {
  type UserContext,
  createDefaultUserContext,
} from './guardrails';
// Legacy types removed - now using generated tools via tool-adapter
import {
  createActionExecutor,
  type ActionExecutor,
  type ActionResult,
  type MCPClient,
} from './action-executor';
import {
  AI_TOOLS,
  getOpenAITools,
  type GeneratedAITool,
} from './generated';

// ============================================================================
// Types
// ============================================================================

/**
 * Conversational service configuration
 */
export interface ConversationalServiceConfig {
  /** OpenAI API key */
  openaiApiKey: string;
  /** MCP client instance */
  mcpClient: MCPClient;
  /** OpenAI model to use */
  model?: string;
  /** System prompt override */
  systemPrompt?: string;
  /** Enable logging */
  enableLogging?: boolean;
}

/**
 * Message from the conversation
 */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Response from the conversational service
 */
export interface ConversationalResponse {
  /** The assistant's text response */
  message: string;
  /** Whether an action was attempted */
  actionAttempted: boolean;
  /** Action result (if applicable) */
  actionResult?: ActionResult;
  /** Pending actions that need confirmation */
  pendingConfirmations: PendingConfirmation[];
  /** Conversation ID for follow-up */
  conversationId: string;
}

/**
 * Pending confirmation info for UI
 */
export interface PendingConfirmation {
  /** Pending action ID */
  id: string;
  /** Human-readable description */
  description: string;
  /** Risk level */
  riskLevel: string;
  /** Expiration time */
  expiresAt: Date;
}

// ============================================================================
// Tool Definitions for OpenAI
// ============================================================================

/**
 * Confirmation and control tools that are always available
 */
const CONTROL_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'confirm_action',
      description: 'Confirm a pending action that requires user approval',
      parameters: {
        type: 'object',
        properties: {
          pending_action_id: {
            type: 'string',
            description: 'The ID of the pending action to confirm',
          },
        },
        required: ['pending_action_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_action',
      description: 'Cancel a pending action',
      parameters: {
        type: 'object',
        properties: {
          pending_action_id: {
            type: 'string',
            description: 'The ID of the pending action to cancel',
          },
        },
        required: ['pending_action_id'],
      },
    },
  },
];

/**
 * Generate OpenAI tool definitions from generated AI tools.
 *
 * This function now uses the auto-generated tools from OpenAPI spec,
 * which provides complete, accurate tool definitions with proper
 * parameter schemas derived from tRPC router definitions.
 *
 * @param scopes Optional scopes to filter tools. If not provided, uses 'global' scope to get all tools.
 * @returns Array of OpenAI-compatible tool definitions
 */
function generateToolDefinitions(
  scopes?: string[]
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  // Use generated tools - they are already in OpenAI format
  // Default to 'global' scope which includes all tools
  const generatedTools = getOpenAITools(scopes ?? ['global']);

  // Combine with control tools
  return [...generatedTools, ...CONTROL_TOOLS];
}

// ============================================================================
// System Prompt
// ============================================================================

const BASE_SYSTEM_PROMPT = `You are the GLAPI Assistant, a helpful AI for managing business operations in the GLAPI accounting and business management system.

## Your Capabilities

You can help users with:
- **Customer Management**: List, search, create, and update customer records
- **Vendor Management**: Manage vendor/supplier information
- **Employee Management**: Handle employee records
- **Lead/Prospect Management**: Track sales leads and prospects
- **Invoice Management**: Create and manage invoices
- **Financial Reports**: Generate balance sheets, income statements, cash flow reports
- **Journal Entries**: Create and post general ledger entries (requires approval)

## Important Guidelines

1. **Always be helpful and professional** - Guide users through their tasks clearly
2. **Confirm before mutations** - For actions that modify data, always confirm with the user first
3. **Explain what you're doing** - Tell users what action you're taking and why
4. **Handle errors gracefully** - If something fails, explain what went wrong and suggest alternatives
5. **Respect permissions** - If a user doesn't have permission, explain politely
6. **Financial accuracy matters** - Double-check amounts and account assignments for financial operations

## Response Format

- Be concise but informative
- Use bullet points for lists
- Format financial amounts with proper currency symbols
- When showing records, include key identifying information

## Confirmation Flow

When an action requires confirmation:
1. Explain what you're about to do
2. Ask for explicit confirmation ("yes" or "confirm")
3. Only proceed after user confirms
4. Allow users to cancel by saying "cancel" or "no"

Remember: You're helping users manage their business operations. Accuracy and clarity are essential.`;

// ============================================================================
// Conversational Service
// ============================================================================

/**
 * Create the conversational service
 */
export function createConversationalService(config: ConversationalServiceConfig) {
  const {
    openaiApiKey,
    mcpClient,
    model = 'gpt-4-0125-preview',
    systemPrompt: systemPromptOverride,
    enableLogging = false,
  } = config;

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: openaiApiKey,
    dangerouslyAllowBrowser: true, // For client-side use - use backend proxy in production
  });

  // Create action executor
  const actionExecutor = createActionExecutor({
    mcpClient,
    enableLogging,
  });

  // Generate tool definitions
  const tools = generateToolDefinitions();

  // System prompt
  const systemPrompt = systemPromptOverride || BASE_SYSTEM_PROMPT;

  /**
   * Process a user message and return a response
   */
  async function processMessage(
    message: string,
    conversationHistory: Message[],
    userContext: UserContext,
    authToken: string,
    conversationId: string
  ): Promise<ConversationalResponse> {
    // Add user message to history
    actionExecutor.addUserMessage(conversationId, message, userContext);

    // Check for confirmation/cancellation keywords
    const lowerMessage = message.toLowerCase().trim();
    if (['yes', 'confirm', 'proceed', 'ok', 'okay'].includes(lowerMessage)) {
      const pendingActions = actionExecutor.getPendingActions(conversationId);
      if (pendingActions.length > 0) {
        const mostRecent = pendingActions[pendingActions.length - 1];
        const result = await actionExecutor.confirmAction(
          conversationId,
          mostRecent.id,
          authToken
        );

        if (result.success) {
          return {
            message: `Action completed successfully. ${formatActionResult(result)}`,
            actionAttempted: true,
            actionResult: result,
            pendingConfirmations: [],
            conversationId,
          };
        } else {
          return {
            message: `Action failed: ${result.error}`,
            actionAttempted: true,
            actionResult: result,
            pendingConfirmations: getPendingConfirmations(conversationId),
            conversationId,
          };
        }
      }
    }

    if (['no', 'cancel', 'nevermind', 'abort'].includes(lowerMessage)) {
      const pendingActions = actionExecutor.getPendingActions(conversationId);
      if (pendingActions.length > 0) {
        const mostRecent = pendingActions[pendingActions.length - 1];
        actionExecutor.cancelAction(conversationId, mostRecent.id);
        return {
          message: 'Action cancelled.',
          actionAttempted: false,
          pendingConfirmations: getPendingConfirmations(conversationId),
          conversationId,
        };
      }
    }

    // Build messages for OpenAI
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    try {
      // Call OpenAI
      const completion = await openai.chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: 'auto',
      });

      const responseMessage = completion.choices[0].message;

      // Handle tool calls
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        const toolCall = responseMessage.tool_calls[0];
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        if (enableLogging) {
          console.log(`[Conversational] Tool call: ${toolName}`, toolArgs);
        }

        // Execute the action
        const actionResult = await actionExecutor.executeAction(
          {
            toolName,
            parameters: toolArgs,
            userMessage: message,
            conversationId,
          },
          userContext,
          authToken
        );

        // Handle confirmation required
        if (actionResult.requiresConfirmation) {
          return {
            message: actionResult.confirmationMessage ||
              `This action requires confirmation. ${actionResult.intent?.name || toolName}. Do you want to proceed?`,
            actionAttempted: true,
            actionResult,
            pendingConfirmations: getPendingConfirmations(conversationId),
            conversationId,
          };
        }

        // Handle success or failure
        if (actionResult.success) {
          // Get natural language response with tool result
          const followUpCompletion = await openai.chat.completions.create({
            model,
            messages: [
              ...messages,
              responseMessage,
              {
                role: 'tool',
                content: JSON.stringify(actionResult.data),
                tool_call_id: toolCall.id,
              },
            ],
          });

          const finalMessage = followUpCompletion.choices[0].message.content ||
            `Action completed: ${formatActionResult(actionResult)}`;

          actionExecutor.addAssistantMessage(conversationId, finalMessage, userContext);

          return {
            message: finalMessage,
            actionAttempted: true,
            actionResult,
            pendingConfirmations: getPendingConfirmations(conversationId),
            conversationId,
          };
        } else {
          return {
            message: `I couldn't complete that action: ${actionResult.error}`,
            actionAttempted: true,
            actionResult,
            pendingConfirmations: getPendingConfirmations(conversationId),
            conversationId,
          };
        }
      }

      // No tool call - return text response
      const textResponse = responseMessage.content || "I'm not sure how to help with that. Could you rephrase your request?";
      actionExecutor.addAssistantMessage(conversationId, textResponse, userContext);

      return {
        message: textResponse,
        actionAttempted: false,
        pendingConfirmations: getPendingConfirmations(conversationId),
        conversationId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Conversational] Error:', errorMessage);

      return {
        message: `I'm sorry, I encountered an error: ${errorMessage}. Please try again.`,
        actionAttempted: false,
        pendingConfirmations: getPendingConfirmations(conversationId),
        conversationId,
      };
    }
  }

  /**
   * Get pending confirmations for UI display
   */
  function getPendingConfirmations(conversationId: string): PendingConfirmation[] {
    const pending = actionExecutor.getPendingActions(conversationId);
    return pending.map((p) => ({
      id: p.id,
      description: p.guardrailResult.confirmationMessage || p.request.toolName,
      riskLevel: p.guardrailResult.intent?.riskLevel || 'UNKNOWN',
      expiresAt: p.expiresAt,
    }));
  }

  /**
   * Format action result for display
   */
  function formatActionResult(result: ActionResult): string {
    if (!result.data) return '';

    if (Array.isArray(result.data)) {
      return `Found ${result.data.length} records.`;
    }

    if (typeof result.data === 'object') {
      const data = result.data as Record<string, unknown>;
      if ('id' in data) {
        return `Record ID: ${data.id}`;
      }
    }

    return JSON.stringify(result.data).substring(0, 100);
  }

  /**
   * Get available capabilities for the user
   */
  function getCapabilities(userContext: UserContext) {
    return actionExecutor.getAvailableActions(userContext);
  }

  /**
   * Clear conversation state
   */
  function clearConversation(conversationId: string): void {
    actionExecutor.clearConversation(conversationId);
  }

  return {
    processMessage,
    getCapabilities,
    clearConversation,
    getPendingConfirmations,
    getConversationHistory: actionExecutor.getConversationHistory,
  };
}

// ============================================================================
// Exports
// ============================================================================

export type ConversationalService = ReturnType<typeof createConversationalService>;
