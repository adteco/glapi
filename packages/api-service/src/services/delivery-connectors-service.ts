import { BaseService, ServiceContext, ServiceError } from './base-service';
import {
  deliveryQueueRepository,
  DeliveryQueueItem,
  NewDeliveryQueueItem,
  DeliveryQueueConfig,
  DeliveryResponse,
  DeliveryAttempt,
  NewDeliveryAttempt,
  DeliveryType,
  DeliveryStatus,
} from '@glapi/database';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface DeliveryResult {
  success: boolean;
  response?: DeliveryResponse;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

export interface DeliveryPayload {
  data: Buffer | string;
  contentType: string;
  filename?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailDeliveryOptions {
  recipients: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType: string;
  }>;
}

export interface WebhookDeliveryOptions {
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  timeout?: number;
  payload: unknown;
}

/**
 * Base interface for all delivery connectors
 */
export interface DeliveryConnector {
  readonly type: DeliveryType;
  deliver(config: DeliveryQueueConfig, payload: DeliveryPayload): Promise<DeliveryResult>;
  validateConfig(config: DeliveryQueueConfig): string[];
}

// ============================================================================
// Email Delivery Connector
// ============================================================================

/**
 * Email delivery connector - sends reports via email with attachments
 *
 * Note: This implementation uses a pluggable email provider interface.
 * In production, inject a real email provider (SendGrid, SES, etc.)
 */
export interface EmailProvider {
  sendEmail(options: EmailDeliveryOptions): Promise<{
    messageId: string;
    acceptedRecipients: string[];
    rejectedRecipients?: string[];
  }>;
}

export class MockEmailProvider implements EmailProvider {
  private sentEmails: EmailDeliveryOptions[] = [];

  async sendEmail(options: EmailDeliveryOptions) {
    this.sentEmails.push(options);
    console.log(`[MockEmailProvider] Sending email to ${options.recipients.join(', ')}`);
    console.log(`  Subject: ${options.subject}`);
    console.log(`  Attachments: ${options.attachments?.length ?? 0}`);

    return {
      messageId: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      acceptedRecipients: options.recipients,
      rejectedRecipients: [],
    };
  }

  getSentEmails(): EmailDeliveryOptions[] {
    return [...this.sentEmails];
  }

  clearSentEmails(): void {
    this.sentEmails = [];
  }
}

export class EmailDeliveryConnector implements DeliveryConnector {
  readonly type: DeliveryType = 'email';
  private provider: EmailProvider;

  constructor(provider?: EmailProvider) {
    this.provider = provider ?? new MockEmailProvider();
  }

  async deliver(config: DeliveryQueueConfig, payload: DeliveryPayload): Promise<DeliveryResult> {
    const validationErrors = this.validateConfig(config);
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_CONFIG',
          message: `Invalid email config: ${validationErrors.join(', ')}`,
        },
      };
    }

    try {
      const attachments: EmailDeliveryOptions['attachments'] = [];

      if (payload.data) {
        const content = typeof payload.data === 'string'
          ? Buffer.from(payload.data)
          : payload.data;

        attachments.push({
          filename: config.attachmentFilename ?? payload.filename ?? 'report',
          content,
          contentType: payload.contentType,
        });
      }

      // Process body template with placeholders
      const bodyText = this.processTemplate(
        config.emailBodyTemplate ?? 'Please find attached the scheduled report.',
        payload.metadata
      );
      const bodyHtml = config.emailBodyHtml
        ? this.processTemplate(config.emailBodyHtml, payload.metadata)
        : undefined;

      const result = await this.provider.sendEmail({
        recipients: config.emailRecipients!,
        subject: this.processTemplate(config.emailSubject ?? 'Scheduled Report', payload.metadata),
        bodyText,
        bodyHtml,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      return {
        success: true,
        response: {
          deliveredAt: new Date().toISOString(),
          messageId: result.messageId,
          acceptedRecipients: result.acceptedRecipients,
          rejectedRecipients: result.rejectedRecipients,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      return {
        success: false,
        error: {
          code: 'EMAIL_DELIVERY_FAILED',
          message,
          stack,
        },
      };
    }
  }

  validateConfig(config: DeliveryQueueConfig): string[] {
    const errors: string[] = [];

    if (!config.emailRecipients || config.emailRecipients.length === 0) {
      errors.push('Email recipients are required');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = config.emailRecipients.filter(e => !emailRegex.test(e));
      if (invalidEmails.length > 0) {
        errors.push(`Invalid email addresses: ${invalidEmails.join(', ')}`);
      }
    }

    return errors;
  }

  private processTemplate(template: string, metadata?: Record<string, unknown>): string {
    if (!metadata) return template;

    let result = template;
    for (const [key, value] of Object.entries(metadata)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value ?? ''));
    }
    return result;
  }
}

// ============================================================================
// Webhook Delivery Connector
// ============================================================================

/**
 * HTTP client interface for webhook delivery
 */
export interface HttpClient {
  post(url: string, options: {
    headers?: Record<string, string>;
    body: string;
    timeout?: number;
  }): Promise<{ status: number; body: string; headers: Record<string, string> }>;

  put(url: string, options: {
    headers?: Record<string, string>;
    body: string;
    timeout?: number;
  }): Promise<{ status: number; body: string; headers: Record<string, string> }>;
}

export class FetchHttpClient implements HttpClient {
  async post(url: string, options: {
    headers?: Record<string, string>;
    body: string;
    timeout?: number;
  }) {
    return this.request('POST', url, options);
  }

  async put(url: string, options: {
    headers?: Record<string, string>;
    body: string;
    timeout?: number;
  }) {
    return this.request('PUT', url, options);
  }

  private async request(
    method: 'POST' | 'PUT',
    url: string,
    options: { headers?: Record<string, string>; body: string; timeout?: number }
  ) {
    const controller = new AbortController();
    const timeout = options.timeout ?? 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: options.body,
        signal: controller.signal,
      });

      const body = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        status: response.status,
        body,
        headers,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export class MockHttpClient implements HttpClient {
  private requests: Array<{ method: string; url: string; options: unknown }> = [];
  private mockResponse = { status: 200, body: '{"success": true}', headers: {} };

  setMockResponse(response: { status: number; body: string; headers?: Record<string, string> }) {
    this.mockResponse = { ...this.mockResponse, ...response };
  }

  async post(url: string, options: { headers?: Record<string, string>; body: string; timeout?: number }) {
    this.requests.push({ method: 'POST', url, options });
    console.log(`[MockHttpClient] POST ${url}`);
    return this.mockResponse;
  }

  async put(url: string, options: { headers?: Record<string, string>; body: string; timeout?: number }) {
    this.requests.push({ method: 'PUT', url, options });
    console.log(`[MockHttpClient] PUT ${url}`);
    return this.mockResponse;
  }

  getRequests() {
    return [...this.requests];
  }

  clearRequests() {
    this.requests = [];
  }
}

export class WebhookDeliveryConnector implements DeliveryConnector {
  readonly type: DeliveryType = 'webhook';
  private httpClient: HttpClient;

  constructor(httpClient?: HttpClient) {
    this.httpClient = httpClient ?? new FetchHttpClient();
  }

  async deliver(config: DeliveryQueueConfig, payload: DeliveryPayload): Promise<DeliveryResult> {
    const validationErrors = this.validateConfig(config);
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_CONFIG',
          message: `Invalid webhook config: ${validationErrors.join(', ')}`,
        },
      };
    }

    try {
      const method = config.webhookMethod ?? 'POST';
      const timeout = config.webhookTimeout ?? 30000;

      // Prepare the payload body
      let body: string;
      if (typeof payload.data === 'string') {
        try {
          // If it's already JSON, parse and wrap it
          const parsed = JSON.parse(payload.data);
          body = JSON.stringify({
            report: parsed,
            metadata: payload.metadata,
            contentType: payload.contentType,
            filename: payload.filename,
            deliveredAt: new Date().toISOString(),
          });
        } catch {
          // Not JSON, send as-is with wrapper
          body = JSON.stringify({
            report: payload.data,
            metadata: payload.metadata,
            contentType: payload.contentType,
            filename: payload.filename,
            deliveredAt: new Date().toISOString(),
          });
        }
      } else {
        // Buffer data - encode as base64
        body = JSON.stringify({
          report: payload.data.toString('base64'),
          encoding: 'base64',
          metadata: payload.metadata,
          contentType: payload.contentType,
          filename: payload.filename,
          deliveredAt: new Date().toISOString(),
        });
      }

      const requestFn = method === 'PUT'
        ? this.httpClient.put.bind(this.httpClient)
        : this.httpClient.post.bind(this.httpClient);

      const response = await requestFn(config.webhookUrl!, {
        headers: config.webhookHeaders,
        body,
        timeout,
      });

      // Check for success (2xx status codes)
      const isSuccess = response.status >= 200 && response.status < 300;

      if (!isSuccess) {
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: `Webhook returned status ${response.status}: ${response.body.substring(0, 500)}`,
          },
        };
      }

      return {
        success: true,
        response: {
          deliveredAt: new Date().toISOString(),
          httpStatus: response.status,
          responseBody: response.body.substring(0, 1000), // Limit stored response
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      // Handle specific error types
      let code = 'WEBHOOK_DELIVERY_FAILED';
      if (message.includes('abort') || message.includes('timeout')) {
        code = 'WEBHOOK_TIMEOUT';
      } else if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
        code = 'WEBHOOK_CONNECTION_FAILED';
      }

      return {
        success: false,
        error: {
          code,
          message,
          stack,
        },
      };
    }
  }

  validateConfig(config: DeliveryQueueConfig): string[] {
    const errors: string[] = [];

    if (!config.webhookUrl) {
      errors.push('Webhook URL is required');
    } else {
      try {
        new URL(config.webhookUrl);
      } catch {
        errors.push('Invalid webhook URL format');
      }
    }

    if (config.webhookMethod && !['POST', 'PUT'].includes(config.webhookMethod)) {
      errors.push('Webhook method must be POST or PUT');
    }

    if (config.webhookTimeout && (config.webhookTimeout < 1000 || config.webhookTimeout > 120000)) {
      errors.push('Webhook timeout must be between 1000ms and 120000ms');
    }

    return errors;
  }
}

// ============================================================================
// Delivery Service (Orchestrator)
// ============================================================================

export interface DeliveryServiceConfig {
  maxRetries?: number;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  emailProvider?: EmailProvider;
  httpClient?: HttpClient;
}

export class DeliveryConnectorsService extends BaseService {
  private connectors: Map<DeliveryType, DeliveryConnector>;
  private maxRetries: number;
  private baseRetryDelayMs: number;
  private maxRetryDelayMs: number;

  constructor(context: ServiceContext, config: DeliveryServiceConfig = {}) {
    super(context);

    this.maxRetries = config.maxRetries ?? 5;
    this.baseRetryDelayMs = config.baseRetryDelayMs ?? 5000; // 5 seconds
    this.maxRetryDelayMs = config.maxRetryDelayMs ?? 300000; // 5 minutes

    // Initialize connectors
    this.connectors = new Map();
    this.connectors.set('email', new EmailDeliveryConnector(config.emailProvider));
    this.connectors.set('webhook', new WebhookDeliveryConnector(config.httpClient));
    // SFTP and S3 connectors can be added later
  }

  // ============================================================================
  // Queue Management
  // ============================================================================

  /**
   * Queue a delivery for processing
   */
  async queueDelivery(data: {
    reportScheduleId?: string;
    jobExecutionId?: string;
    deliveryType: DeliveryType;
    deliveryConfig: DeliveryQueueConfig;
    reportType: string;
    outputFormat: string;
    outputLocation?: string;
    outputSizeBytes?: number;
  }): Promise<DeliveryQueueItem> {
    // Validate the config
    const connector = this.connectors.get(data.deliveryType);
    if (!connector) {
      throw new ServiceError(
        `Unsupported delivery type: ${data.deliveryType}`,
        'UNSUPPORTED_DELIVERY_TYPE',
        400
      );
    }

    const validationErrors = connector.validateConfig(data.deliveryConfig);
    if (validationErrors.length > 0) {
      throw new ServiceError(
        `Invalid delivery config: ${validationErrors.join(', ')}`,
        'INVALID_DELIVERY_CONFIG',
        400
      );
    }

    const queueItem: NewDeliveryQueueItem = {
      organizationId: this.context.organizationId,
      reportScheduleId: data.reportScheduleId,
      jobExecutionId: data.jobExecutionId,
      deliveryType: data.deliveryType,
      deliveryConfig: data.deliveryConfig,
      reportType: data.reportType,
      outputFormat: data.outputFormat,
      outputLocation: data.outputLocation,
      outputSizeBytes: data.outputSizeBytes,
      maxAttempts: this.maxRetries,
      createdBy: this.context.userId,
    };

    return deliveryQueueRepository.create(queueItem);
  }

  /**
   * Queue multiple deliveries (for a report with multiple delivery targets)
   */
  async queueMultipleDeliveries(
    base: {
      reportScheduleId?: string;
      jobExecutionId?: string;
      reportType: string;
      outputFormat: string;
      outputLocation?: string;
      outputSizeBytes?: number;
    },
    deliveryConfigs: Array<{ type: DeliveryType; config: DeliveryQueueConfig }>
  ): Promise<DeliveryQueueItem[]> {
    const queueItems: NewDeliveryQueueItem[] = [];

    for (const { type, config } of deliveryConfigs) {
      const connector = this.connectors.get(type);
      if (!connector) continue;

      const validationErrors = connector.validateConfig(config);
      if (validationErrors.length > 0) continue;

      queueItems.push({
        organizationId: this.context.organizationId,
        reportScheduleId: base.reportScheduleId,
        jobExecutionId: base.jobExecutionId,
        deliveryType: type,
        deliveryConfig: config,
        reportType: base.reportType,
        outputFormat: base.outputFormat,
        outputLocation: base.outputLocation,
        outputSizeBytes: base.outputSizeBytes,
        maxAttempts: this.maxRetries,
        createdBy: this.context.userId,
      });
    }

    return deliveryQueueRepository.createMany(queueItems);
  }

  // ============================================================================
  // Delivery Processing
  // ============================================================================

  /**
   * Process a single delivery item
   */
  async processDelivery(
    item: DeliveryQueueItem,
    payload: DeliveryPayload
  ): Promise<DeliveryResult> {
    const connector = this.connectors.get(item.deliveryType);
    if (!connector) {
      const error = {
        code: 'UNSUPPORTED_DELIVERY_TYPE',
        message: `Unsupported delivery type: ${item.deliveryType}`,
      };
      await this.recordFailure(item, error);
      return { success: false, error };
    }

    // Mark as processing
    const processingItem = await deliveryQueueRepository.markAsProcessing(item.id);
    if (!processingItem) {
      return {
        success: false,
        error: {
          code: 'ALREADY_PROCESSING',
          message: 'Delivery item is already being processed',
        },
      };
    }

    // Record attempt start
    const attemptStartedAt = new Date();
    const attemptNumber = processingItem.attemptCount;

    // Attempt delivery
    const result = await connector.deliver(item.deliveryConfig, payload);

    // Record the attempt
    const attemptCompletedAt = new Date();
    await this.recordAttempt({
      deliveryQueueId: item.id,
      organizationId: item.organizationId,
      attemptNumber,
      success: result.success ? 'true' : 'false',
      startedAt: attemptStartedAt,
      completedAt: attemptCompletedAt,
      durationMs: attemptCompletedAt.getTime() - attemptStartedAt.getTime(),
      responseStatus: result.response?.httpStatus,
      errorCode: result.error?.code,
      errorMessage: result.error?.message,
    });

    // Update queue item status
    if (result.success) {
      await deliveryQueueRepository.markAsDelivered(item.id, result.response ?? {});
    } else {
      await this.recordFailure(processingItem, result.error!);
    }

    return result;
  }

  /**
   * Process pending deliveries in batch
   */
  async processPendingDeliveries(
    getPayload: (item: DeliveryQueueItem) => Promise<DeliveryPayload | null>,
    batchSize = 10
  ): Promise<{ processed: number; succeeded: number; failed: number }> {
    const pendingItems = await deliveryQueueRepository.findPendingDeliveries(batchSize);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const item of pendingItems) {
      const payload = await getPayload(item);
      if (!payload) {
        // Skip if payload not available
        continue;
      }

      const result = await this.processDelivery(item, payload);
      processed++;

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return { processed, succeeded, failed };
  }

  // ============================================================================
  // Retry and DLQ Management
  // ============================================================================

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attemptCount: number): number {
    const exponentialDelay = this.baseRetryDelayMs * Math.pow(2, attemptCount - 1);
    const jitter = Math.random() * 0.2 * exponentialDelay; // 20% jitter
    return Math.min(exponentialDelay + jitter, this.maxRetryDelayMs);
  }

  /**
   * Record a delivery failure and schedule retry
   */
  private async recordFailure(
    item: DeliveryQueueItem,
    error: { code: string; message: string; stack?: string }
  ): Promise<void> {
    const shouldRetry = item.attemptCount < item.maxAttempts;
    const nextRetryAt = shouldRetry
      ? new Date(Date.now() + this.calculateRetryDelay(item.attemptCount))
      : undefined;

    await deliveryQueueRepository.markAsFailed(item.id, error, nextRetryAt);
  }

  /**
   * Record a delivery attempt for audit purposes
   */
  private async recordAttempt(data: {
    deliveryQueueId: string;
    organizationId: string;
    attemptNumber: number;
    success: string;
    startedAt: Date;
    completedAt: Date;
    durationMs: number;
    responseStatus?: number;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<DeliveryAttempt> {
    const attemptData: NewDeliveryAttempt = {
      deliveryQueueId: data.deliveryQueueId,
      organizationId: data.organizationId,
      attemptNumber: data.attemptNumber,
      success: data.success,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
      durationMs: data.durationMs,
      responseStatus: data.responseStatus,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
    };

    return deliveryQueueRepository.recordAttempt(attemptData);
  }

  /**
   * Get dead letter items for review
   */
  async getDeadLetterItems(limit = 100): Promise<DeliveryQueueItem[]> {
    return deliveryQueueRepository.getDeadLetterItems(this.context.organizationId, limit);
  }

  /**
   * Retry a dead letter item
   */
  async retryDeadLetter(itemId: string): Promise<DeliveryQueueItem> {
    const item = await deliveryQueueRepository.findById(itemId);
    if (!item) {
      throw new ServiceError('Delivery item not found', 'NOT_FOUND', 404);
    }

    if (item.organizationId !== this.context.organizationId) {
      throw new ServiceError('Delivery item not found', 'NOT_FOUND', 404);
    }

    if (item.status !== 'dead_letter') {
      throw new ServiceError('Item is not in dead letter queue', 'INVALID_STATUS', 400);
    }

    const result = await deliveryQueueRepository.retryDeadLetter(itemId);
    if (!result) {
      throw new ServiceError('Failed to retry delivery', 'UPDATE_FAILED', 500);
    }

    return result;
  }

  // ============================================================================
  // Statistics and Queries
  // ============================================================================

  /**
   * Get delivery queue statistics
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    delivered: number;
    failed: number;
    deadLetter: number;
    total: number;
  }> {
    return deliveryQueueRepository.getStats(this.context.organizationId);
  }

  /**
   * List delivery items with filters
   */
  async listDeliveries(options: {
    status?: DeliveryStatus | DeliveryStatus[];
    deliveryType?: DeliveryType;
    page?: number;
    limit?: number;
  }): Promise<{ items: DeliveryQueueItem[]; total: number }> {
    return deliveryQueueRepository.list({
      organizationId: this.context.organizationId,
      ...options,
    });
  }

  /**
   * Get delivery by ID
   */
  async getDelivery(id: string): Promise<DeliveryQueueItem | null> {
    const item = await deliveryQueueRepository.findById(id);
    if (item && item.organizationId !== this.context.organizationId) {
      return null;
    }
    return item;
  }

  /**
   * Get delivery attempts for an item
   */
  async getDeliveryAttempts(deliveryId: string): Promise<DeliveryAttempt[]> {
    const item = await this.getDelivery(deliveryId);
    if (!item) {
      throw new ServiceError('Delivery item not found', 'NOT_FOUND', 404);
    }

    return deliveryQueueRepository.getAttemptsByDeliveryId(deliveryId);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Validate a delivery config without queueing
   */
  validateDeliveryConfig(type: DeliveryType, config: DeliveryQueueConfig): string[] {
    const connector = this.connectors.get(type);
    if (!connector) {
      return [`Unsupported delivery type: ${type}`];
    }
    return connector.validateConfig(config);
  }

  /**
   * Get supported delivery types
   */
  getSupportedDeliveryTypes(): DeliveryType[] {
    return Array.from(this.connectors.keys());
  }

  /**
   * Map output format to content type
   */
  static getContentType(outputFormat: string): string {
    const contentTypes: Record<string, string> = {
      json: 'application/json',
      csv: 'text/csv',
      pdf: 'application/pdf',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return contentTypes[outputFormat.toLowerCase()] ?? 'application/octet-stream';
  }

  /**
   * Get file extension for output format
   */
  static getFileExtension(outputFormat: string): string {
    return outputFormat.toLowerCase();
  }
}
