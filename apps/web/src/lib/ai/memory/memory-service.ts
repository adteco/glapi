/**
 * GLAPI Memory Service
 *
 * Wraps Magneteco client to provide memory augmentation for the AI chat agent.
 * Handles retrieval, storage, and formatting of conversation memory.
 */

import {
  MagnetoClient,
  createMagnetoClient,
  type MemoryContext,
  type MemorizeResponse,
  type ClientRetrieveRequest,
  type ClientMemorizeRequest,
  MagnetoError,
  MagnetoNetworkError,
} from './magneteco-client';

// ============================================================================
// Types
// ============================================================================

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface MemoryServiceConfig {
  /** Enable memory features (default: true if configured) */
  enabled?: boolean;
  /** Maximum tokens for memory context (default: 2000) */
  maxTokens?: number;
  /** Time decay in days for relevance scoring (default: 30) */
  timeDecayDays?: number;
  /** Categories to filter memory retrieval */
  categories?: string[];
  /** Enable debug logging */
  debug?: boolean;
}

export interface RetrieveOptions {
  /** Maximum tokens for this retrieval */
  maxTokens?: number;
  /** Categories to filter */
  categories?: string[];
  /** Time decay in days */
  timeDecayDays?: number;
}

export interface MemorizeOptions {
  /** Thread/conversation ID for grouping */
  threadId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format memory context as a string for LLM system prompts.
 *
 * @example
 * ```ts
 * const context = await memoryService.retrieve(userId, query);
 * const systemPrompt = `You are an assistant.
 *
 * ${formatMemoryContext(context)}
 *
 * Answer the user's question.`;
 * ```
 */
export function formatMemoryContext(context: MemoryContext): string {
  const parts: string[] = [];

  // Add category summaries
  const summaryEntries = Object.entries(context.summaries);
  if (summaryEntries.length > 0) {
    parts.push('## Memory Context\n');
    for (const [category, summary] of summaryEntries) {
      // Format category name nicely
      const formattedCategory = category
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      parts.push(`### ${formattedCategory}\n${summary}\n`);
    }
  }

  // Add relevant items
  if (context.relevantItems && context.relevantItems.length > 0) {
    parts.push('\n## Recent Relevant Memories\n');
    for (const item of context.relevantItems.slice(0, 10)) {
      const date = new Date(item.createdAt).toLocaleDateString();
      const importanceTag = item.importance === 'critical' || item.importance === 'high'
        ? ` [${item.importance.toUpperCase()}]`
        : '';
      parts.push(`- [${date}]${importanceTag} ${item.content}`);
    }
  }

  // Add entity context if available
  if (context.entities && context.entities.length > 0) {
    parts.push('\n## Related Entities\n');
    for (const entity of context.entities.slice(0, 5)) {
      parts.push(`- **${entity.name}** (${entity.type})`);
      if (entity.relationships.length > 0) {
        for (const rel of entity.relationships.slice(0, 3)) {
          parts.push(`  - ${rel.predicate} ${rel.target}`);
        }
      }
    }
  }

  return parts.join('\n');
}

/**
 * Format a conversation for memorization.
 *
 * @example
 * ```ts
 * await memoryService.memorize(
 *   userId,
 *   formatConversation(messages),
 *   { threadId: conversationId }
 * );
 * ```
 */
export function formatConversation(messages: Message[]): string {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
}

/**
 * Format a single exchange (user message + assistant response) for memorization.
 */
export function formatExchange(userMessage: string, assistantResponse: string): string {
  return `User: ${userMessage}\n\nAssistant: ${assistantResponse}`;
}

// ============================================================================
// Memory Service
// ============================================================================

export class MemoryService {
  private client: MagnetoClient | null;
  private config: Required<MemoryServiceConfig>;

  constructor(config: MemoryServiceConfig = {}) {
    this.client = createMagnetoClient();
    this.config = {
      enabled: config.enabled ?? true,
      maxTokens: config.maxTokens ?? 2000,
      timeDecayDays: config.timeDecayDays ?? 30,
      categories: config.categories ?? [],
      debug: config.debug ?? (process.env.NODE_ENV === 'development'),
    };

    if (this.config.debug) {
      if (this.client) {
        console.log('[MemoryService] Initialized with Magneteco client');
      } else {
        console.log('[MemoryService] Running without memory (no Magneteco config)');
      }
    }
  }

  /**
   * Check if memory service is available and enabled.
   */
  isAvailable(): boolean {
    return this.config.enabled && this.client !== null;
  }

  /**
   * Retrieve memory context for a query.
   *
   * @param userId - User identifier
   * @param query - The query/message to find relevant memories for
   * @param options - Optional retrieval options
   * @returns Memory context or null if unavailable
   */
  async retrieve(
    userId: string,
    query: string,
    options: RetrieveOptions = {}
  ): Promise<MemoryContext | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const request: ClientRetrieveRequest = {
        userId,
        query,
        maxTokens: options.maxTokens ?? this.config.maxTokens,
        timeDecayDays: options.timeDecayDays ?? this.config.timeDecayDays,
      };

      // Add categories if specified
      const categories = options.categories ?? this.config.categories;
      if (categories.length > 0) {
        request.categories = categories;
      }

      const context = await this.client!.retrieve(request);

      if (this.config.debug) {
        console.log('[MemoryService] Retrieved context:', {
          summaryCount: Object.keys(context.summaries).length,
          itemCount: context.relevantItems.length,
          entityCount: context.entities?.length ?? 0,
          tokenCount: context.tokenCount,
        });
      }

      return context;
    } catch (error) {
      this.handleError('retrieve', error);
      return null;
    }
  }

  /**
   * Store content for memory extraction.
   *
   * @param userId - User identifier
   * @param content - Content to memorize (conversation, event, or document)
   * @param options - Optional memorization options
   * @returns Memorize response or null if unavailable
   */
  async memorize(
    userId: string,
    content: string,
    options: MemorizeOptions = {}
  ): Promise<MemorizeResponse | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const request: ClientMemorizeRequest = {
        userId,
        content,
        contentType: 'conversation',
        threadId: options.threadId,
        metadata: options.metadata,
      };

      const response = await this.client!.memorize(request);

      if (this.config.debug) {
        console.log('[MemoryService] Memorized content:', {
          resourceId: response.resourceId,
          status: response.status,
          estimatedTime: response.estimatedProcessingTime,
        });
      }

      return response;
    } catch (error) {
      this.handleError('memorize', error);
      return null;
    }
  }

  /**
   * Store a conversation exchange (user message + assistant response).
   *
   * This is a convenience method for storing chat interactions.
   *
   * @param userId - User identifier
   * @param userMessage - The user's message
   * @param assistantResponse - The assistant's response
   * @param conversationId - Optional conversation/thread ID
   */
  async memorizeExchange(
    userId: string,
    userMessage: string,
    assistantResponse: string,
    conversationId?: string
  ): Promise<MemorizeResponse | null> {
    const content = formatExchange(userMessage, assistantResponse);
    return this.memorize(userId, content, {
      threadId: conversationId,
      metadata: {
        type: 'chat_exchange',
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Retrieve formatted memory context string for LLM injection.
   *
   * @param userId - User identifier
   * @param query - The query to find relevant memories for
   * @param options - Optional retrieval options
   * @returns Formatted memory string or empty string if unavailable
   */
  async getFormattedContext(
    userId: string,
    query: string,
    options: RetrieveOptions = {}
  ): Promise<string> {
    const context = await this.retrieve(userId, query, options);
    if (!context) {
      return '';
    }
    return formatMemoryContext(context);
  }

  /**
   * Get memory categories for a user.
   */
  async getCategories(
    userId: string
  ): Promise<Array<{ name: string; itemCount: number }> | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const response = await this.client!.getCategories(userId);
      return response.categories;
    } catch (error) {
      this.handleError('getCategories', error);
      return null;
    }
  }

  /**
   * Check the health of the memory service.
   */
  async healthCheck(): Promise<{ available: boolean; status?: string; version?: string }> {
    if (!this.client) {
      return { available: false };
    }

    try {
      const health = await this.client.health();
      return {
        available: true,
        status: health.status,
        version: health.version,
      };
    } catch (error) {
      this.handleError('healthCheck', error);
      return { available: false };
    }
  }

  /**
   * Handle errors gracefully without breaking the chat flow.
   */
  private handleError(operation: string, error: unknown): void {
    if (error instanceof MagnetoError) {
      console.error(`[MemoryService] ${operation} failed:`, {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
      });
    } else if (error instanceof MagnetoNetworkError) {
      console.error(`[MemoryService] ${operation} network error:`, error.message);
    } else {
      console.error(`[MemoryService] ${operation} unexpected error:`, error);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let memoryServiceInstance: MemoryService | null = null;

/**
 * Get the singleton memory service instance.
 *
 * @param config - Optional configuration (only used on first call)
 */
export function getMemoryService(config?: MemoryServiceConfig): MemoryService {
  if (!memoryServiceInstance) {
    memoryServiceInstance = new MemoryService(config);
  }
  return memoryServiceInstance;
}

/**
 * Reset the memory service instance (useful for testing).
 */
export function resetMemoryService(): void {
  memoryServiceInstance = null;
}
