/**
 * Magneteco Memory Client
 *
 * Official client SDK for Magneteco memory service.
 * Provides memory augmentation for AI chat agents.
 *
 * Based on @magneteco/client - inlined for zero external dependencies.
 */

// ============================================================================
// API Types
// ============================================================================

export type ContentType = 'conversation' | 'event' | 'document';

export type Importance = 'critical' | 'high' | 'medium' | 'low';

export interface MemorizeResponse {
  status: 'queued' | 'processed';
  resourceId: string;
  estimatedProcessingTime?: number;
}

export interface MemoryItem {
  id: string;
  appId: string;
  userId: string;
  resourceId: string;
  category: string;
  content: string;
  confidence: number;
  importance: Importance;
  createdAt: Date | string;
  lastAccessedAt?: Date | string;
  accessCount: number;
  archived: boolean;
}

export interface MemoryContext {
  summaries: Record<string, string>;
  relevantItems: Omit<MemoryItem, 'embedding'>[];
  entities?: Array<{
    name: string;
    type: string;
    properties: Record<string, unknown>;
    relationships: Array<{
      predicate: string;
      target: string;
      targetType: string;
    }>;
  }>;
  tokenCount: number;
  query: string;
}

export interface ProcessingStatusResponse {
  resourceId: string;
  status: 'queued' | 'extracting' | 'writing' | 'completed' | 'failed';
  factsExtracted: number;
  factsWritten: number;
  error?: string | null;
  startedAt: string;
  completedAt?: string | null;
  estimatedTimeRemaining?: number | null;
}

// ============================================================================
// Client Configuration
// ============================================================================

export interface MagnetoClientConfig {
  /** Magneteco API base URL (e.g., https://api.magneteco.io) */
  baseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom fetch implementation (for testing or custom environments) */
  fetch?: typeof fetch;
}

export interface ClientMemorizeRequest {
  /** Unique identifier for the user */
  userId: string;
  /** Content to store and extract memories from */
  content: string;
  /** Type of content */
  contentType: ContentType;
  /** Optional thread/session ID for grouping related content */
  threadId?: string;
  /** Optional metadata to attach */
  metadata?: Record<string, unknown>;
}

export interface ClientRetrieveRequest {
  /** Unique identifier for the user */
  userId: string;
  /** Query to find relevant memories */
  query: string;
  /** Maximum tokens in response (default: 2000) */
  maxTokens?: number;
  /** Filter to specific categories */
  categories?: string[];
  /** Time decay factor in days (default: 30) */
  timeDecayDays?: number;
}

// ============================================================================
// Domain Configuration Types
// ============================================================================

export interface CategoryDefinition {
  name: string;
  description: string;
  examples?: string[];
  alwaysInclude?: boolean;
  maxSummaryTokens?: number;
}

export interface EntityProperty {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  description?: string;
  required?: boolean;
}

export interface EntityTypeDefinition {
  name: string;
  description: string;
  properties?: EntityProperty[];
  examples?: string[];
}

export interface RelationshipDefinition {
  name: string;
  description: string;
  fromTypes: string[];
  toTypes: string[];
  properties?: EntityProperty[];
  exclusive?: boolean;
}

export interface RelevanceRule {
  type: 'always_remember' | 'never_remember' | 'boost' | 'decay';
  pattern: string;
  description?: string;
  factor?: number;
}

export interface DomainConfig {
  appId: string;
  name: string;
  description: string;
  version?: string;
  categories: CategoryDefinition[];
  entityTypes?: EntityTypeDefinition[];
  relationshipTypes?: RelationshipDefinition[];
  relevanceRules?: RelevanceRule[];
  extractionPromptAdditions?: string;
  maxItemsPerUser?: number;
  maxEntitiesPerUser?: number;
  retentionDays?: number;
}

// ============================================================================
// Error Classes
// ============================================================================

export class MagnetoError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MagnetoError';
  }
}

export class MagnetoNetworkError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'MagnetoNetworkError';
  }
}

// ============================================================================
// Client Implementation
// ============================================================================

export class MagnetoClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private debug: boolean;
  private fetchFn: typeof fetch;

  constructor(config: MagnetoClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 30000;
    this.debug = config.debug ?? false;
    this.fetchFn = config.fetch ?? globalThis.fetch;

    if (!this.baseUrl) {
      throw new Error('MagnetoClient: baseUrl is required');
    }
    if (!this.apiKey) {
      throw new Error('MagnetoClient: apiKey is required');
    }
  }

  private log(...args: unknown[]) {
    if (this.debug) {
      console.log('[MagnetoClient]', ...args);
    }
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    this.log(`${method} ${url}`, body ? JSON.stringify(body) : '');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchFn(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      this.log(`Response ${response.status}:`, responseText);

      if (!response.ok) {
        let errorData: { error?: { code?: string; message?: string; details?: Record<string, unknown> } } = {};
        try {
          errorData = JSON.parse(responseText);
        } catch {
          // Response wasn't JSON
        }

        throw new MagnetoError(
          errorData.error?.message ?? `Request failed with status ${response.status}`,
          errorData.error?.code ?? 'UNKNOWN_ERROR',
          response.status,
          errorData.error?.details
        );
      }

      return responseText ? JSON.parse(responseText) : ({} as T);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof MagnetoError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new MagnetoNetworkError(`Request timed out after ${this.timeout}ms`);
        }
        throw new MagnetoNetworkError(error.message, error);
      }

      throw new MagnetoNetworkError('Unknown network error');
    }
  }

  // ==========================================================================
  // Core Methods
  // ==========================================================================

  /**
   * Store content for memory extraction.
   *
   * The content will be processed asynchronously:
   * 1. Stored as a raw resource
   * 2. Facts extracted using LLM
   * 3. Facts embedded and indexed
   * 4. Category summaries updated
   *
   * @example
   * ```ts
   * const result = await client.memorize({
   *   userId: 'user-123',
   *   content: 'User prefers dark mode and uses TypeScript',
   *   contentType: 'conversation',
   * });
   * console.log(result.resourceId); // Track processing status
   * ```
   */
  async memorize(request: ClientMemorizeRequest): Promise<MemorizeResponse> {
    return this.request<MemorizeResponse>('POST', '/api/memorize', request);
  }

  /**
   * Retrieve memory context for a query.
   *
   * Returns category summaries and relevant memory items
   * that can be injected into an LLM prompt.
   *
   * @example
   * ```ts
   * const context = await client.retrieve({
   *   userId: 'user-123',
   *   query: 'What are the user\'s preferences?',
   * });
   * console.log(context.summaries); // Category summaries
   * console.log(context.relevantItems); // Matching memories
   * ```
   */
  async retrieve(request: ClientRetrieveRequest): Promise<MemoryContext> {
    return this.request<MemoryContext>('POST', '/api/retrieve', request);
  }

  /**
   * Check the processing status of a memorize request.
   *
   * @example
   * ```ts
   * const status = await client.getStatus(resourceId);
   * if (status.status === 'completed') {
   *   console.log(`Extracted ${status.factsExtracted} facts`);
   * }
   * ```
   */
  async getStatus(resourceId: string): Promise<ProcessingStatusResponse> {
    return this.request<ProcessingStatusResponse>(
      'GET',
      `/api/memorize/${resourceId}/status`
    );
  }

  /**
   * List available memory categories for a user.
   */
  async getCategories(
    userId: string
  ): Promise<{ categories: Array<{ name: string; itemCount: number }> }> {
    return this.request(
      'GET',
      `/api/retrieve/categories?userId=${encodeURIComponent(userId)}`
    );
  }

  /**
   * Check API health status.
   */
  async health(): Promise<{ status: string; version?: string }> {
    return this.request('GET', '/health');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a Magneteco client from environment variables.
 *
 * Looks for:
 * - MAGNETECO_URL or NEXT_PUBLIC_MAGNETECO_URL
 * - MAGNETECO_API_KEY
 *
 * @example
 * ```ts
 * const client = createMagnetoClient();
 * if (client) {
 *   const context = await client.retrieve({ userId, query });
 * }
 * ```
 */
export function createMagnetoClient(): MagnetoClient | null {
  const baseUrl =
    process.env.MAGNETECO_URL ??
    process.env.NEXT_PUBLIC_MAGNETECO_URL ??
    '';
  const apiKey = process.env.MAGNETECO_API_KEY ?? '';

  if (!baseUrl || !apiKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[MagnetoClient] Missing MAGNETECO_URL or MAGNETECO_API_KEY environment variables'
      );
    }
    return null;
  }

  return new MagnetoClient({
    baseUrl,
    apiKey,
    debug: process.env.NODE_ENV === 'development',
  });
}
