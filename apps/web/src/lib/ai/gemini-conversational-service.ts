/**
 * GLAPI Conversational Ledger - Gemini Conversational Service
 *
 * This module provides the main conversational AI service using Google's Gemini model:
 * 1. Processes natural language messages
 * 2. Maps to intents via LLM
 * 3. Enforces guardrails and approvals
 * 4. Executes actions and returns responses
 */

import {
  GoogleGenerativeAI,
  type FunctionDeclaration,
  type FunctionDeclarationSchema,
  type Part,
  type Content,
  FunctionCallingMode,
  SchemaType,
} from '@google/generative-ai';
import {
  type UserContext,
  createDefaultUserContext,
} from './guardrails';
// Legacy types removed - now using generated tools via tool-adapter
import {
  getAllEnabledTools,
  type UnifiedToolInfo,
} from './tool-adapter';
import {
  createActionExecutor,
  type ActionExecutor,
  type ActionResult,
  type MCPClient,
} from './action-executor';
import {
  getMemoryService,
  type MemoryServiceConfig,
} from './memory';

// ============================================================================
// Types
// ============================================================================

/**
 * Gemini service configuration
 */
export interface GeminiServiceConfig {
  /** Gemini API key */
  geminiApiKey: string;
  /** MCP client instance */
  mcpClient: MCPClient;
  /** Gemini model to use */
  model?: string;
  /** System prompt override */
  systemPrompt?: string;
  /** Enable logging */
  enableLogging?: boolean;
  /** Memory service configuration */
  memory?: MemoryServiceConfig & {
    /** Enable memory features (default: true if Magneteco is configured) */
    enabled?: boolean;
  };
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
  /** Tool name for execution (for serverless) */
  toolName?: string;
  /** Tool parameters (for serverless) */
  parameters?: Record<string, unknown>;
  /** Intent info */
  intent?: {
    id: string;
    name: string;
  };
}

// ============================================================================
// Enhanced System Prompt
// ============================================================================

export const GLAPI_SYSTEM_PROMPT = `You are the GLAPI Assistant, an intelligent AI assistant for managing business operations in GLAPI (General Ledger API) - a comprehensive construction-focused accounting and business management platform.

## System Overview

GLAPI is a full-featured ERP system designed for construction companies, service businesses, and professional services firms. It provides:

### Core Modules

**1. Relationship Management**
- **Customers**: Companies that purchase from you (tracked with entity types, company hierarchy)
- **Vendors**: Suppliers and subcontractors you purchase from
- **Contacts**: Individual people linked to companies (with job titles, departments, multiple phone numbers)
- **Leads**: Potential customers in early sales pipeline
- **Prospects**: Qualified leads with higher conversion potential
- **Employees**: Internal team members with roles and permissions

**2. Sales & Revenue**
- **Estimates/Quotes**: Create proposals with line items, costs, and markup calculations (GM%, GP%)
- **Sales Orders**: Confirmed orders awaiting fulfillment
- **Invoices**: Bills sent to customers for payment
- **Credit Memos**: Credits issued to customers
- **Customer Refunds**: Processing returns of customer payments
- **Pay Applications**: AIA-style billing for construction contracts
- **Schedule of Values (SOV)**: Contract breakdown for progress billing

**3. Purchasing & Expenses**
- **Bills**: Invoices from vendors you need to pay
- **Bill Payments**: Recording payments to vendors
- **Vendor Credits**: Credits received from vendors
- **Expense Entries**: Employee expense tracking
- **Purchase Orders**: (coming soon)

**4. Construction & Projects**
- **Projects/Jobs**: Job cost tracking with budgets and phases
- **Project Cost Codes**: Standard cost classification system
- **Time Entries**: Labor tracking with approval workflows
- **Change Orders**: Contract modifications
- **WIP Reporting**: Work in Progress analysis
- **Job Cost Posting**: Recording costs to projects

**5. Accounting & Finance**
- **Chart of Accounts**: Full GL account structure
- **Journal Entries**: General ledger postings
- **Bank Deposits**: Recording incoming funds
- **Accounting Periods**: Period management and close process
- **Consolidation**: Multi-entity financial consolidation
- **Financial Statements**: Balance Sheet, Income Statement, Cash Flow

**6. Configuration & Settings**
- **Subsidiaries**: Multi-company structure
- **Departments**: Organizational units
- **Locations**: Physical locations/branches
- **Classes**: Transaction categorization
- **Items**: Products and services catalog
- **Price Lists**: Customer-specific pricing
- **Accounting Lists**: Payment terms, methods, charge types

**7. Workflows & Automation**
- **Dynamic Workflows**: Customizable multi-step workflows
- **Task Management**: Entity-linked tasks with fields
- **Email Templates**: Automated communication
- **Report Schedules**: Automated report delivery

## Your Capabilities

You can help users with:
- **Search & Query**: Find customers, vendors, invoices, projects, and more
- **Data Entry**: Create new records (with confirmation for financial transactions)
- **Updates**: Modify existing records
- **Reports**: Generate financial statements and business reports
- **Calculations**: Help with pricing, margins, and profitability analysis
- **Guidance**: Explain accounting concepts and system features

## Important Guidelines

1. **Be Context-Aware**: Always consider what the user is trying to accomplish
2. **Confirm Before Mutations**: For actions that create or modify data, summarize what you'll do and ask for confirmation
3. **Financial Accuracy**: Double-check amounts and calculations for financial operations
4. **Explain Clearly**: Tell users what you're doing and why
5. **Handle Errors Gracefully**: If something fails, explain what went wrong and suggest alternatives
6. **Respect Permissions**: If a user doesn't have permission, explain politely
7. **Use Proper Formatting**: Format amounts as currency, use bullet points for lists

## Construction Industry Context

GLAPI is built for construction businesses, so understand:
- **Jobs/Projects**: Long-running contracts with multiple phases
- **Progress Billing**: AIA-style pay applications with retention
- **Cost Codes**: Standard industry cost categorization
- **Change Orders**: Contract modifications are common
- **WIP**: Work in Progress reporting is critical for contractors
- **Retention**: Held-back portions of contract amounts

## Response Format

- Be concise but informative
- Use bullet points for lists
- Format financial amounts with $ and proper decimals
- Show key identifying information for records
- Provide context when relevant

## Confirmation Flow

When an action requires confirmation:
1. Explain what you're about to do with specific details
2. Ask for explicit confirmation ("yes" or "confirm")
3. Only proceed after user confirms
4. Allow users to cancel by saying "cancel" or "no"

Remember: You're helping users manage their business operations efficiently. Accuracy, clarity, and helpfulness are essential.`;

// ============================================================================
// Tool Definitions for Gemini
// ============================================================================

/**
 * Generate Gemini function declarations from enabled tools
 *
 * Now uses generated tools via tool-adapter instead of legacy intent catalog.
 */
function generateFunctionDeclarations(): FunctionDeclaration[] {
  const declarations: FunctionDeclaration[] = [];

  for (const tool of getAllEnabledTools()) {
    const decl = getFunctionDeclarationForTool(tool);
    if (decl) {
      declarations.push(decl);
    }
  }

  // Add confirmation tools
  declarations.push({
    name: 'confirm_action',
    description: 'Confirm a pending action that requires user approval',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        pending_action_id: {
          type: SchemaType.STRING,
          description: 'The ID of the pending action to confirm',
        },
      },
      required: ['pending_action_id'],
    },
  });

  declarations.push({
    name: 'cancel_action',
    description: 'Cancel a pending action',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        pending_action_id: {
          type: SchemaType.STRING,
          description: 'The ID of the pending action to cancel',
        },
      },
      required: ['pending_action_id'],
    },
  });

  return declarations;
}

/**
 * Map a unified tool to a Gemini function declaration
 *
 * Uses the tool name to look up the parameter schema.
 */
function getFunctionDeclarationForTool(
  tool: UnifiedToolInfo
): FunctionDeclaration | null {
  // Get the tool name for schema lookup (from generated tool or convert from legacy)
  const toolName = tool.generatedTool?.metadata.name || tool.id.toLowerCase();
  // Define parameter schemas for each tool type
  const toolSchemas: Record<string, FunctionDeclarationSchema> = {
    // Customer tools
    list_customers: {
      type: SchemaType.OBJECT,
      properties: {
        search: { type: SchemaType.STRING, description: 'Search term for customer name' },
        status: {
          type: SchemaType.STRING,
          enum: ['active', 'inactive', 'all'],
          description: 'Filter by status (default: active)',
        },
        limit: { type: SchemaType.NUMBER, description: 'Maximum results to return (default: 50)' },
      },
    },
    get_customer: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING, description: 'Customer ID' },
      },
      required: ['id'],
    },
    create_customer: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, description: 'Customer/company name' },
        email: { type: SchemaType.STRING, description: 'Email address' },
        phone: { type: SchemaType.STRING, description: 'Phone number' },
      },
      required: ['name'],
    },
    update_customer: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING, description: 'Customer ID' },
        name: { type: SchemaType.STRING, description: 'Updated name' },
        email: { type: SchemaType.STRING, description: 'Updated email' },
        phone: { type: SchemaType.STRING, description: 'Updated phone' },
        status: { type: SchemaType.STRING, enum: ['active', 'inactive'] },
      },
      required: ['id'],
    },

    // Vendor tools
    list_vendors: {
      type: SchemaType.OBJECT,
      properties: {
        search: { type: SchemaType.STRING, description: 'Search term' },
        status: { type: SchemaType.STRING, enum: ['active', 'inactive', 'all'] },
        limit: { type: SchemaType.NUMBER },
      },
    },
    create_vendor: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, description: 'Vendor name' },
        email: { type: SchemaType.STRING },
        phone: { type: SchemaType.STRING },
      },
      required: ['name'],
    },

    // Employee tools
    list_employees: {
      type: SchemaType.OBJECT,
      properties: {
        search: { type: SchemaType.STRING },
        status: { type: SchemaType.STRING, enum: ['active', 'inactive', 'all'] },
        limit: { type: SchemaType.NUMBER },
      },
    },
    create_employee: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING },
        email: { type: SchemaType.STRING },
        phone: { type: SchemaType.STRING },
      },
      required: ['name'],
    },

    // Lead/Prospect/Contact tools
    list_leads: {
      type: SchemaType.OBJECT,
      properties: {
        search: { type: SchemaType.STRING },
        status: { type: SchemaType.STRING, enum: ['active', 'inactive', 'all'] },
        limit: { type: SchemaType.NUMBER },
      },
    },
    create_lead: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING },
        email: { type: SchemaType.STRING },
        phone: { type: SchemaType.STRING },
      },
      required: ['name'],
    },
    list_prospects: {
      type: SchemaType.OBJECT,
      properties: {
        search: { type: SchemaType.STRING },
        limit: { type: SchemaType.NUMBER },
      },
    },
    list_contacts: {
      type: SchemaType.OBJECT,
      properties: {
        search: { type: SchemaType.STRING },
        limit: { type: SchemaType.NUMBER },
      },
    },

    // Invoice tools
    list_invoices: {
      type: SchemaType.OBJECT,
      properties: {
        customerId: { type: SchemaType.STRING, description: 'Filter by customer' },
        status: { type: SchemaType.STRING, enum: ['draft', 'sent', 'paid', 'overdue'] },
        limit: { type: SchemaType.NUMBER },
      },
    },
    create_invoice: {
      type: SchemaType.OBJECT,
      properties: {
        customerId: { type: SchemaType.STRING, description: 'Customer ID' },
        dueDate: { type: SchemaType.STRING, description: 'Due date (ISO format)' },
        lineItems: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              description: { type: SchemaType.STRING },
              quantity: { type: SchemaType.NUMBER },
              rate: { type: SchemaType.NUMBER },
            },
          },
        },
      },
      required: ['customerId'],
    },

    // Project tools
    list_projects: {
      type: SchemaType.OBJECT,
      properties: {
        search: { type: SchemaType.STRING },
        status: { type: SchemaType.STRING },
        customerId: { type: SchemaType.STRING },
        limit: { type: SchemaType.NUMBER },
      },
    },

    // Estimate tools
    list_estimates: {
      type: SchemaType.OBJECT,
      properties: {
        search: { type: SchemaType.STRING },
        customerId: { type: SchemaType.STRING },
        status: { type: SchemaType.STRING },
        limit: { type: SchemaType.NUMBER },
      },
    },

    // Journal entry tools
    create_journal_entry: {
      type: SchemaType.OBJECT,
      properties: {
        date: { type: SchemaType.STRING, description: 'Entry date' },
        description: { type: SchemaType.STRING },
        lines: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              accountId: { type: SchemaType.STRING },
              debit: { type: SchemaType.NUMBER },
              credit: { type: SchemaType.NUMBER },
            },
          },
        },
      },
      required: ['date', 'lines'],
    },

    // Report tools
    generate_balance_sheet: {
      type: SchemaType.OBJECT,
      properties: {
        asOfDate: { type: SchemaType.STRING, description: 'Report date' },
        subsidiaryId: { type: SchemaType.STRING },
      },
    },
    generate_income_statement: {
      type: SchemaType.OBJECT,
      properties: {
        startDate: { type: SchemaType.STRING },
        endDate: { type: SchemaType.STRING },
        subsidiaryId: { type: SchemaType.STRING },
      },
    },

    // Help tools
    help: {
      type: SchemaType.OBJECT,
      properties: {
        topic: { type: SchemaType.STRING, description: 'Help topic' },
      },
    },
    explain_concept: {
      type: SchemaType.OBJECT,
      properties: {
        concept: { type: SchemaType.STRING, description: 'Concept to explain' },
      },
      required: ['concept'],
    },
  };

  const schema = toolSchemas[toolName];
  if (!schema) {
    return null;
  }

  return {
    name: toolName,
    description: tool.description,
    parameters: schema,
  };
}

// ============================================================================
// Gemini Conversational Service
// ============================================================================

/**
 * Create the Gemini conversational service
 */
export function createGeminiConversationalService(config: GeminiServiceConfig) {
  const {
    geminiApiKey,
    mcpClient,
    model = 'gemini-2.0-flash',
    systemPrompt: systemPromptOverride,
    enableLogging = false,
    memory: memoryConfig,
  } = config;

  // Initialize Gemini client
  const genAI = new GoogleGenerativeAI(geminiApiKey);

  // Generate function declarations
  const functionDeclarations = generateFunctionDeclarations();

  // Initialize memory service (if configured)
  const memoryService = getMemoryService(memoryConfig);
  const memoryEnabled = memoryConfig?.enabled !== false && memoryService.isAvailable();

  if (enableLogging) {
    console.log('[GeminiService] Memory service:', memoryEnabled ? 'enabled' : 'disabled');
  }

  // Create the model with tools
  const generativeModel = genAI.getGenerativeModel({
    model,
    tools: [{
      functionDeclarations,
    }],
    systemInstruction: systemPromptOverride || GLAPI_SYSTEM_PROMPT,
  });

  // Create action executor
  const actionExecutor = createActionExecutor({
    mcpClient,
    enableLogging,
  });

  /**
   * Convert our message format to Gemini content format
   * Gemini requires: 1) First message must be 'user', 2) Alternating user/model roles
   */
  function messagesToContents(messages: Message[]): Content[] {
    // Filter out system messages (Gemini handles system instruction separately)
    const filtered = messages.filter(m => m.role !== 'system');

    // Find the first user message index
    const firstUserIndex = filtered.findIndex(m => m.role === 'user');

    // If no user messages, return empty history
    if (firstUserIndex === -1) {
      return [];
    }

    // Start from the first user message
    const validMessages = filtered.slice(firstUserIndex);

    // Convert to Gemini format, ensuring proper alternation
    const contents: Content[] = [];
    let lastRole: 'user' | 'model' | null = null;

    for (const m of validMessages) {
      const role = m.role === 'assistant' ? 'model' : 'user';

      // Skip if same role as previous (Gemini requires alternation)
      // Merge consecutive same-role messages instead
      if (role === lastRole && contents.length > 0) {
        const lastContent = contents[contents.length - 1];
        lastContent.parts.push({ text: m.content });
      } else {
        contents.push({
          role,
          parts: [{ text: m.content }],
        });
        lastRole = role;
      }
    }

    return contents;
  }

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

    try {
      // Retrieve memory context if available
      let memoryContext = '';
      if (memoryEnabled) {
        try {
          memoryContext = await memoryService.getFormattedContext(
            userContext.userId,
            message,
            { maxTokens: memoryConfig?.maxTokens ?? 2000 }
          );
          if (enableLogging && memoryContext) {
            console.log('[GeminiService] Retrieved memory context:', memoryContext.length, 'chars');
          }
        } catch (memoryError) {
          // Don't fail the request if memory retrieval fails
          if (enableLogging) {
            console.error('[GeminiService] Memory retrieval failed:', memoryError);
          }
        }
      }

      // Build enhanced system instruction with memory context
      const systemInstruction = memoryContext
        ? `${systemPromptOverride || GLAPI_SYSTEM_PROMPT}\n\n${memoryContext}`
        : (systemPromptOverride || GLAPI_SYSTEM_PROMPT);

      // Create a model instance with memory-enhanced system instruction
      const modelWithMemory = memoryContext
        ? genAI.getGenerativeModel({
            model,
            tools: [{ functionDeclarations }],
            systemInstruction,
          })
        : generativeModel;

      // Start a chat session with history
      const chat = modelWithMemory.startChat({
        history: messagesToContents(conversationHistory),
      });

      // Send the message
      const result = await chat.sendMessage(message);
      const response = result.response;

      // Check for function calls
      const functionCalls = response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        const functionCall = functionCalls[0];
        const toolName = functionCall.name;
        const toolArgs = functionCall.args as Record<string, unknown>;

        if (enableLogging) {
          console.log(`[Gemini] Function call: ${toolName}`, toolArgs);
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
              `This action requires confirmation: ${actionResult.intent?.name || toolName}. Do you want to proceed?`,
            actionAttempted: true,
            actionResult,
            pendingConfirmations: getPendingConfirmations(conversationId),
            conversationId,
          };
        }

        // Handle success or failure
        if (actionResult.success) {
          // Send function result back to get natural language response
          const functionResponse = await chat.sendMessage([{
            functionResponse: {
              name: toolName,
              response: actionResult.data as object,
            },
          }]);

          const finalMessage = functionResponse.response.text() ||
            `Action completed: ${formatActionResult(actionResult)}`;

          actionExecutor.addAssistantMessage(conversationId, finalMessage, userContext);

          // Store exchange in memory (fire and forget)
          if (memoryEnabled) {
            memoryService.memorizeExchange(
              userContext.userId,
              message,
              finalMessage,
              conversationId
            ).catch((err) => {
              if (enableLogging) {
                console.error('[GeminiService] Memory storage failed:', err);
              }
            });
          }

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

      // No function call - return text response
      const textResponse = response.text() || "I'm not sure how to help with that. Could you rephrase your request?";
      actionExecutor.addAssistantMessage(conversationId, textResponse, userContext);

      // Store exchange in memory (fire and forget)
      if (memoryEnabled) {
        memoryService.memorizeExchange(
          userContext.userId,
          message,
          textResponse,
          conversationId
        ).catch((err) => {
          if (enableLogging) {
            console.error('[GeminiService] Memory storage failed:', err);
          }
        });
      }

      return {
        message: textResponse,
        actionAttempted: false,
        pendingConfirmations: getPendingConfirmations(conversationId),
        conversationId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Gemini] Error:', errorMessage);

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
      // Include action details for serverless execution
      toolName: p.request.toolName,
      parameters: p.request.parameters,
      intent: p.guardrailResult.intent ? {
        id: p.guardrailResult.intent.id,
        name: p.guardrailResult.intent.name,
      } : undefined,
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

export type GeminiConversationalService = ReturnType<typeof createGeminiConversationalService>;
