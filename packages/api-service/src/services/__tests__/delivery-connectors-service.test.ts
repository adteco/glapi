import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  DeliveryConnectorsService,
  EmailDeliveryConnector,
  WebhookDeliveryConnector,
  MockEmailProvider,
  MockHttpClient,
  DeliveryPayload,
} from '../delivery-connectors-service';
import { ServiceContext } from '../base-service';
import { DeliveryQueueConfig, DeliveryQueueItem } from '@glapi/database';

// Mock the repository
vi.mock('@glapi/database', async () => {
  const actual = await vi.importActual('@glapi/database');
  return {
    ...actual,
    deliveryQueueRepository: {
      create: vi.fn(),
      createMany: vi.fn(),
      findById: vi.fn(),
      findByJobExecutionId: vi.fn(),
      findByScheduleId: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findPendingDeliveries: vi.fn(),
      findPendingByType: vi.fn(),
      markAsProcessing: vi.fn(),
      markAsDelivered: vi.fn(),
      markAsFailed: vi.fn(),
      moveToDeadLetter: vi.fn(),
      retryDeadLetter: vi.fn(),
      recordAttempt: vi.fn(),
      getAttemptsByDeliveryId: vi.fn(),
      getStats: vi.fn(),
      getDeadLetterItems: vi.fn(),
      list: vi.fn(),
      cleanupOldDeliveries: vi.fn(),
    },
  };
});

import { deliveryQueueRepository } from '@glapi/database';

const mockRepo = vi.mocked(deliveryQueueRepository);

describe('DeliveryConnectorsService', () => {
  let service: DeliveryConnectorsService;
  let mockEmailProvider: MockEmailProvider;
  let mockHttpClient: MockHttpClient;
  let mockContext: ServiceContext;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

    mockEmailProvider = new MockEmailProvider();
    mockHttpClient = new MockHttpClient();

    mockContext = {
      organizationId: 'org-123',
      userId: 'user-456',
    } as ServiceContext;

    service = new DeliveryConnectorsService(mockContext, {
      emailProvider: mockEmailProvider,
      httpClient: mockHttpClient,
      maxRetries: 5,
      baseRetryDelayMs: 5000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Email Delivery Connector', () => {
    let emailConnector: EmailDeliveryConnector;

    beforeEach(() => {
      emailConnector = new EmailDeliveryConnector(mockEmailProvider);
    });

    it('should validate email config - missing recipients', () => {
      const config: DeliveryQueueConfig = {
        type: 'email',
        emailSubject: 'Test Report',
      };

      const errors = emailConnector.validateConfig(config);
      expect(errors).toContain('Email recipients are required');
    });

    it('should validate email config - invalid email address', () => {
      const config: DeliveryQueueConfig = {
        type: 'email',
        emailRecipients: ['valid@email.com', 'invalid-email'],
      };

      const errors = emailConnector.validateConfig(config);
      expect(errors.some(e => e.includes('Invalid email addresses'))).toBe(true);
    });

    it('should validate valid email config', () => {
      const config: DeliveryQueueConfig = {
        type: 'email',
        emailRecipients: ['user@example.com', 'admin@example.com'],
        emailSubject: 'Test Report',
      };

      const errors = emailConnector.validateConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should deliver email successfully', async () => {
      const config: DeliveryQueueConfig = {
        type: 'email',
        emailRecipients: ['user@example.com'],
        emailSubject: 'Test Report - {{reportName}}',
        emailBodyTemplate: 'Here is your {{reportType}} report.',
      };

      const payload: DeliveryPayload = {
        data: '{"data": "test"}',
        contentType: 'application/json',
        filename: 'report.json',
        metadata: {
          reportName: 'Monthly Summary',
          reportType: 'financial',
        },
      };

      const result = await emailConnector.deliver(config, payload);

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response?.acceptedRecipients).toContain('user@example.com');

      const sentEmails = mockEmailProvider.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].subject).toBe('Test Report - Monthly Summary');
      expect(sentEmails[0].bodyText).toBe('Here is your financial report.');
      expect(sentEmails[0].attachments).toHaveLength(1);
    });

    it('should deliver email with attachment', async () => {
      const config: DeliveryQueueConfig = {
        type: 'email',
        emailRecipients: ['user@example.com'],
        attachmentFilename: 'custom-report.csv',
      };

      const payload: DeliveryPayload = {
        data: 'col1,col2\nval1,val2',
        contentType: 'text/csv',
      };

      await emailConnector.deliver(config, payload);

      const sentEmails = mockEmailProvider.getSentEmails();
      expect(sentEmails[0].attachments?.[0].filename).toBe('custom-report.csv');
      expect(sentEmails[0].attachments?.[0].contentType).toBe('text/csv');
    });

    it('should handle email delivery failure', async () => {
      const failingProvider: MockEmailProvider = {
        async sendEmail() {
          throw new Error('SMTP connection failed');
        },
      } as unknown as MockEmailProvider;

      const failingConnector = new EmailDeliveryConnector(failingProvider);

      const config: DeliveryQueueConfig = {
        type: 'email',
        emailRecipients: ['user@example.com'],
      };

      const payload: DeliveryPayload = {
        data: 'test',
        contentType: 'text/plain',
      };

      const result = await failingConnector.deliver(config, payload);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EMAIL_DELIVERY_FAILED');
      expect(result.error?.message).toBe('SMTP connection failed');
    });
  });

  describe('Webhook Delivery Connector', () => {
    let webhookConnector: WebhookDeliveryConnector;

    beforeEach(() => {
      webhookConnector = new WebhookDeliveryConnector(mockHttpClient);
    });

    it('should validate webhook config - missing URL', () => {
      const config: DeliveryQueueConfig = {
        type: 'webhook',
      };

      const errors = webhookConnector.validateConfig(config);
      expect(errors).toContain('Webhook URL is required');
    });

    it('should validate webhook config - invalid URL', () => {
      const config: DeliveryQueueConfig = {
        type: 'webhook',
        webhookUrl: 'not-a-valid-url',
      };

      const errors = webhookConnector.validateConfig(config);
      expect(errors).toContain('Invalid webhook URL format');
    });

    it('should validate webhook config - invalid method', () => {
      const config: DeliveryQueueConfig = {
        type: 'webhook',
        webhookUrl: 'https://example.com/webhook',
        webhookMethod: 'GET' as any,
      };

      const errors = webhookConnector.validateConfig(config);
      expect(errors).toContain('Webhook method must be POST or PUT');
    });

    it('should validate webhook config - timeout out of range', () => {
      const config: DeliveryQueueConfig = {
        type: 'webhook',
        webhookUrl: 'https://example.com/webhook',
        webhookTimeout: 500, // Too short
      };

      const errors = webhookConnector.validateConfig(config);
      expect(errors).toContain('Webhook timeout must be between 1000ms and 120000ms');
    });

    it('should validate valid webhook config', () => {
      const config: DeliveryQueueConfig = {
        type: 'webhook',
        webhookUrl: 'https://example.com/webhook',
        webhookMethod: 'POST',
        webhookHeaders: { 'X-API-Key': 'secret' },
        webhookTimeout: 30000,
      };

      const errors = webhookConnector.validateConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should deliver via POST webhook successfully', async () => {
      mockHttpClient.setMockResponse({
        status: 200,
        body: '{"received": true}',
        headers: { 'content-type': 'application/json' },
      });

      const config: DeliveryQueueConfig = {
        type: 'webhook',
        webhookUrl: 'https://example.com/webhook',
        webhookHeaders: { 'X-API-Key': 'test-key' },
      };

      const payload: DeliveryPayload = {
        data: '{"report": "data"}',
        contentType: 'application/json',
        filename: 'report.json',
        metadata: { reportId: '123' },
      };

      const result = await webhookConnector.deliver(config, payload);

      expect(result.success).toBe(true);
      expect(result.response?.httpStatus).toBe(200);

      const requests = mockHttpClient.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].method).toBe('POST');
      expect(requests[0].url).toBe('https://example.com/webhook');
    });

    it('should deliver via PUT webhook', async () => {
      mockHttpClient.setMockResponse({ status: 201, body: 'Created' });

      const config: DeliveryQueueConfig = {
        type: 'webhook',
        webhookUrl: 'https://example.com/resource',
        webhookMethod: 'PUT',
      };

      const payload: DeliveryPayload = {
        data: 'test data',
        contentType: 'text/plain',
      };

      const result = await webhookConnector.deliver(config, payload);

      expect(result.success).toBe(true);
      const requests = mockHttpClient.getRequests();
      expect(requests[0].method).toBe('PUT');
    });

    it('should handle non-2xx response as failure', async () => {
      mockHttpClient.setMockResponse({
        status: 500,
        body: 'Internal Server Error',
      });

      const config: DeliveryQueueConfig = {
        type: 'webhook',
        webhookUrl: 'https://example.com/webhook',
      };

      const payload: DeliveryPayload = {
        data: 'test',
        contentType: 'text/plain',
      };

      const result = await webhookConnector.deliver(config, payload);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('HTTP_500');
      expect(result.error?.message).toContain('status 500');
    });

    it('should handle binary data with base64 encoding', async () => {
      mockHttpClient.setMockResponse({ status: 200, body: '{}' });

      const config: DeliveryQueueConfig = {
        type: 'webhook',
        webhookUrl: 'https://example.com/webhook',
      };

      const binaryData = Buffer.from([0x50, 0x44, 0x46, 0x2d]); // PDF magic bytes
      const payload: DeliveryPayload = {
        data: binaryData,
        contentType: 'application/pdf',
        filename: 'report.pdf',
      };

      await webhookConnector.deliver(config, payload);

      const requests = mockHttpClient.getRequests();
      const body = JSON.parse((requests[0].options as any).body);
      expect(body.encoding).toBe('base64');
      expect(body.contentType).toBe('application/pdf');
    });
  });

  describe('Queue Management', () => {
    it('should queue a delivery', async () => {
      const mockQueueItem: DeliveryQueueItem = {
        id: 'queue-1',
        organizationId: 'org-123',
        reportScheduleId: 'schedule-1',
        jobExecutionId: 'exec-1',
        deliveryType: 'email',
        deliveryConfig: {
          type: 'email',
          emailRecipients: ['user@example.com'],
        },
        reportType: 'income_statement',
        outputFormat: 'pdf',
        outputLocation: 's3://bucket/report.pdf',
        outputSizeBytes: 1024,
        status: 'pending',
        attemptCount: 0,
        maxAttempts: 5,
        scheduledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as DeliveryQueueItem;

      mockRepo.create.mockResolvedValue(mockQueueItem);

      const result = await service.queueDelivery({
        reportScheduleId: 'schedule-1',
        jobExecutionId: 'exec-1',
        deliveryType: 'email',
        deliveryConfig: {
          type: 'email',
          emailRecipients: ['user@example.com'],
        },
        reportType: 'income_statement',
        outputFormat: 'pdf',
        outputLocation: 's3://bucket/report.pdf',
        outputSizeBytes: 1024,
      });

      expect(result.id).toBe('queue-1');
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-123',
          deliveryType: 'email',
        })
      );
    });

    it('should reject unsupported delivery type', async () => {
      await expect(
        service.queueDelivery({
          deliveryType: 'fax' as any, // Not supported
          deliveryConfig: { type: 'fax' as any },
          reportType: 'income_statement',
          outputFormat: 'pdf',
        })
      ).rejects.toThrow('Unsupported delivery type');
    });

    it('should reject invalid delivery config', async () => {
      await expect(
        service.queueDelivery({
          deliveryType: 'email',
          deliveryConfig: {
            type: 'email',
            emailRecipients: [], // Empty recipients
          },
          reportType: 'income_statement',
          outputFormat: 'pdf',
        })
      ).rejects.toThrow('Invalid delivery config');
    });

    it('should queue multiple deliveries', async () => {
      mockRepo.createMany.mockResolvedValue([
        { id: 'queue-1' } as DeliveryQueueItem,
        { id: 'queue-2' } as DeliveryQueueItem,
      ]);

      const result = await service.queueMultipleDeliveries(
        {
          reportScheduleId: 'schedule-1',
          reportType: 'income_statement',
          outputFormat: 'pdf',
        },
        [
          {
            type: 'email',
            config: {
              type: 'email',
              emailRecipients: ['user@example.com'],
            },
          },
          {
            type: 'webhook',
            config: {
              type: 'webhook',
              webhookUrl: 'https://example.com/webhook',
            },
          },
        ]
      );

      expect(result).toHaveLength(2);
      expect(mockRepo.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ deliveryType: 'email' }),
          expect.objectContaining({ deliveryType: 'webhook' }),
        ])
      );
    });
  });

  describe('Delivery Processing', () => {
    it('should process delivery successfully', async () => {
      const queueItem: DeliveryQueueItem = {
        id: 'queue-1',
        organizationId: 'org-123',
        deliveryType: 'email',
        deliveryConfig: {
          type: 'email',
          emailRecipients: ['user@example.com'],
        },
        status: 'pending',
        attemptCount: 0,
        maxAttempts: 5,
      } as DeliveryQueueItem;

      mockRepo.markAsProcessing.mockResolvedValue({
        ...queueItem,
        status: 'processing',
        attemptCount: 1,
      } as DeliveryQueueItem);
      mockRepo.markAsDelivered.mockResolvedValue({
        ...queueItem,
        status: 'delivered',
      } as DeliveryQueueItem);
      mockRepo.recordAttempt.mockResolvedValue({} as any);

      const payload: DeliveryPayload = {
        data: 'test data',
        contentType: 'text/plain',
      };

      const result = await service.processDelivery(queueItem, payload);

      expect(result.success).toBe(true);
      expect(mockRepo.markAsProcessing).toHaveBeenCalledWith('queue-1');
      expect(mockRepo.markAsDelivered).toHaveBeenCalled();
      expect(mockRepo.recordAttempt).toHaveBeenCalled();
    });

    it('should handle already processing item', async () => {
      const queueItem: DeliveryQueueItem = {
        id: 'queue-1',
        organizationId: 'org-123',
        deliveryType: 'email',
        deliveryConfig: {
          type: 'email',
          emailRecipients: ['user@example.com'],
        },
        status: 'processing',
        attemptCount: 1,
        maxAttempts: 5,
      } as DeliveryQueueItem;

      mockRepo.markAsProcessing.mockResolvedValue(null); // Already processing

      const payload: DeliveryPayload = {
        data: 'test',
        contentType: 'text/plain',
      };

      const result = await service.processDelivery(queueItem, payload);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ALREADY_PROCESSING');
    });

    it('should record failure and schedule retry', async () => {
      mockHttpClient.setMockResponse({ status: 500, body: 'Error' });

      const queueItem: DeliveryQueueItem = {
        id: 'queue-1',
        organizationId: 'org-123',
        deliveryType: 'webhook',
        deliveryConfig: {
          type: 'webhook',
          webhookUrl: 'https://example.com/webhook',
        },
        status: 'pending',
        attemptCount: 1,
        maxAttempts: 5,
      } as DeliveryQueueItem;

      mockRepo.markAsProcessing.mockResolvedValue({
        ...queueItem,
        status: 'processing',
        attemptCount: 2,
      } as DeliveryQueueItem);
      mockRepo.markAsFailed.mockResolvedValue({
        ...queueItem,
        status: 'failed',
      } as DeliveryQueueItem);
      mockRepo.recordAttempt.mockResolvedValue({} as any);

      const payload: DeliveryPayload = {
        data: 'test',
        contentType: 'text/plain',
      };

      const result = await service.processDelivery(queueItem, payload);

      expect(result.success).toBe(false);
      expect(mockRepo.markAsFailed).toHaveBeenCalledWith(
        'queue-1',
        expect.objectContaining({ code: 'HTTP_500' }),
        expect.any(Date) // nextRetryAt
      );
    });
  });

  describe('Retry and DLQ Management', () => {
    it('should get dead letter items', async () => {
      const deadLetterItems: DeliveryQueueItem[] = [
        {
          id: 'dlq-1',
          organizationId: 'org-123',
          status: 'dead_letter',
        } as DeliveryQueueItem,
      ];

      mockRepo.getDeadLetterItems.mockResolvedValue(deadLetterItems);

      const result = await service.getDeadLetterItems();

      expect(result).toHaveLength(1);
      expect(mockRepo.getDeadLetterItems).toHaveBeenCalledWith('org-123', 100);
    });

    it('should retry dead letter item', async () => {
      const dlqItem: DeliveryQueueItem = {
        id: 'dlq-1',
        organizationId: 'org-123',
        status: 'dead_letter',
      } as DeliveryQueueItem;

      mockRepo.findById.mockResolvedValue(dlqItem);
      mockRepo.retryDeadLetter.mockResolvedValue({
        ...dlqItem,
        status: 'pending',
        attemptCount: 0,
      } as DeliveryQueueItem);

      const result = await service.retryDeadLetter('dlq-1');

      expect(result.status).toBe('pending');
      expect(result.attemptCount).toBe(0);
    });

    it('should reject retry for non-dead-letter item', async () => {
      const pendingItem: DeliveryQueueItem = {
        id: 'queue-1',
        organizationId: 'org-123',
        status: 'pending',
      } as DeliveryQueueItem;

      mockRepo.findById.mockResolvedValue(pendingItem);

      await expect(service.retryDeadLetter('queue-1')).rejects.toThrow(
        'Item is not in dead letter queue'
      );
    });

    it('should reject retry for item from different organization', async () => {
      const dlqItem: DeliveryQueueItem = {
        id: 'dlq-1',
        organizationId: 'other-org',
        status: 'dead_letter',
      } as DeliveryQueueItem;

      mockRepo.findById.mockResolvedValue(dlqItem);

      await expect(service.retryDeadLetter('dlq-1')).rejects.toThrow('not found');
    });
  });

  describe('Statistics and Queries', () => {
    it('should get delivery statistics', async () => {
      const stats = {
        pending: 5,
        processing: 2,
        delivered: 100,
        failed: 3,
        deadLetter: 1,
        total: 111,
      };

      mockRepo.getStats.mockResolvedValue(stats);

      const result = await service.getStats();

      expect(result).toEqual(stats);
      expect(mockRepo.getStats).toHaveBeenCalledWith('org-123');
    });

    it('should list deliveries with filters', async () => {
      mockRepo.list.mockResolvedValue({
        items: [{ id: 'queue-1' } as DeliveryQueueItem],
        total: 1,
      });

      const result = await service.listDeliveries({
        status: 'pending',
        deliveryType: 'email',
        page: 1,
        limit: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(mockRepo.list).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-123',
          status: 'pending',
          deliveryType: 'email',
        })
      );
    });

    it('should get delivery by ID', async () => {
      const item: DeliveryQueueItem = {
        id: 'queue-1',
        organizationId: 'org-123',
      } as DeliveryQueueItem;

      mockRepo.findById.mockResolvedValue(item);

      const result = await service.getDelivery('queue-1');

      expect(result?.id).toBe('queue-1');
    });

    it('should return null for delivery from different organization', async () => {
      const item: DeliveryQueueItem = {
        id: 'queue-1',
        organizationId: 'other-org',
      } as DeliveryQueueItem;

      mockRepo.findById.mockResolvedValue(item);

      const result = await service.getDelivery('queue-1');

      expect(result).toBeNull();
    });
  });

  describe('Utility Methods', () => {
    it('should validate delivery config', () => {
      const emailErrors = service.validateDeliveryConfig('email', {
        type: 'email',
        emailRecipients: [],
      });
      expect(emailErrors).toContain('Email recipients are required');

      const webhookErrors = service.validateDeliveryConfig('webhook', {
        type: 'webhook',
      });
      expect(webhookErrors).toContain('Webhook URL is required');

      const unsupportedErrors = service.validateDeliveryConfig('fax' as any, {
        type: 'fax' as any,
      });
      expect(unsupportedErrors[0]).toContain('Unsupported delivery type');
    });

    it('should return supported delivery types', () => {
      const types = service.getSupportedDeliveryTypes();
      expect(types).toContain('email');
      expect(types).toContain('webhook');
    });

    it('should map output format to content type', () => {
      expect(DeliveryConnectorsService.getContentType('json')).toBe('application/json');
      expect(DeliveryConnectorsService.getContentType('csv')).toBe('text/csv');
      expect(DeliveryConnectorsService.getContentType('pdf')).toBe('application/pdf');
      expect(DeliveryConnectorsService.getContentType('xlsx')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(DeliveryConnectorsService.getContentType('unknown')).toBe('application/octet-stream');
    });

    it('should get file extension for output format', () => {
      expect(DeliveryConnectorsService.getFileExtension('JSON')).toBe('json');
      expect(DeliveryConnectorsService.getFileExtension('CSV')).toBe('csv');
    });
  });

  describe('CSV/PDF Attachment Support', () => {
    it('should handle CSV attachment', async () => {
      const config: DeliveryQueueConfig = {
        type: 'email',
        emailRecipients: ['user@example.com'],
        attachmentFilename: 'report.csv',
      };

      const csvData = 'Name,Amount\nAlice,100\nBob,200';
      const payload: DeliveryPayload = {
        data: csvData,
        contentType: 'text/csv',
        filename: 'report.csv',
      };

      const emailConnector = new EmailDeliveryConnector(mockEmailProvider);
      await emailConnector.deliver(config, payload);

      const sentEmails = mockEmailProvider.getSentEmails();
      expect(sentEmails[0].attachments?.[0].contentType).toBe('text/csv');
      expect(sentEmails[0].attachments?.[0].filename).toBe('report.csv');
    });

    it('should handle PDF attachment as binary', async () => {
      const config: DeliveryQueueConfig = {
        type: 'email',
        emailRecipients: ['user@example.com'],
        attachmentFilename: 'report.pdf',
      };

      // PDF magic bytes + some content
      const pdfBuffer = Buffer.from('%PDF-1.4 sample content');
      const payload: DeliveryPayload = {
        data: pdfBuffer,
        contentType: 'application/pdf',
        filename: 'report.pdf',
      };

      const emailConnector = new EmailDeliveryConnector(mockEmailProvider);
      await emailConnector.deliver(config, payload);

      const sentEmails = mockEmailProvider.getSentEmails();
      expect(sentEmails[0].attachments?.[0].contentType).toBe('application/pdf');
      expect(Buffer.isBuffer(sentEmails[0].attachments?.[0].content)).toBe(true);
    });

    it('should handle XLSX attachment', async () => {
      const config: DeliveryQueueConfig = {
        type: 'webhook',
        webhookUrl: 'https://example.com/webhook',
      };

      // XLSX is binary
      const xlsxBuffer = Buffer.from('PK\x03\x04 fake xlsx content');
      const payload: DeliveryPayload = {
        data: xlsxBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: 'report.xlsx',
      };

      mockHttpClient.setMockResponse({ status: 200, body: '{}' });
      const webhookConnector = new WebhookDeliveryConnector(mockHttpClient);
      await webhookConnector.deliver(config, payload);

      const requests = mockHttpClient.getRequests();
      const body = JSON.parse((requests[0].options as any).body);

      // Binary data should be base64 encoded for webhooks
      expect(body.encoding).toBe('base64');
      expect(body.contentType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    });
  });

  describe('Batch Processing', () => {
    it('should process pending deliveries in batch', async () => {
      const pendingItems: DeliveryQueueItem[] = [
        {
          id: 'queue-1',
          organizationId: 'org-123',
          deliveryType: 'email',
          deliveryConfig: {
            type: 'email',
            emailRecipients: ['user1@example.com'],
          },
          status: 'pending',
          attemptCount: 0,
          maxAttempts: 5,
        } as DeliveryQueueItem,
        {
          id: 'queue-2',
          organizationId: 'org-123',
          deliveryType: 'email',
          deliveryConfig: {
            type: 'email',
            emailRecipients: ['user2@example.com'],
          },
          status: 'pending',
          attemptCount: 0,
          maxAttempts: 5,
        } as DeliveryQueueItem,
      ];

      mockRepo.findPendingDeliveries.mockResolvedValue(pendingItems);
      mockRepo.markAsProcessing.mockImplementation(async (id) => ({
        ...pendingItems.find((p) => p.id === id)!,
        status: 'processing',
        attemptCount: 1,
      }));
      mockRepo.markAsDelivered.mockImplementation(async (id) => ({
        ...pendingItems.find((p) => p.id === id)!,
        status: 'delivered',
      }));
      mockRepo.recordAttempt.mockResolvedValue({} as any);

      const getPayload = async (): Promise<DeliveryPayload> => ({
        data: 'test',
        contentType: 'text/plain',
      });

      const result = await service.processPendingDeliveries(getPayload, 10);

      expect(result.processed).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should skip items where payload is not available', async () => {
      const pendingItems: DeliveryQueueItem[] = [
        {
          id: 'queue-1',
          organizationId: 'org-123',
          deliveryType: 'email',
          deliveryConfig: {
            type: 'email',
            emailRecipients: ['user@example.com'],
          },
        } as DeliveryQueueItem,
      ];

      mockRepo.findPendingDeliveries.mockResolvedValue(pendingItems);

      // Return null payload
      const getPayload = async (): Promise<DeliveryPayload | null> => null;

      const result = await service.processPendingDeliveries(getPayload, 10);

      expect(result.processed).toBe(0);
    });
  });
});
