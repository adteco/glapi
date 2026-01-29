import { BaseService } from './base-service';
import {
  ServiceContext,
  ServiceError,
  GlPostingResult,
  BusinessTransaction,
  BusinessTransactionLine,
  GlPostingRule,
} from '../types';
import { GlPostingEngine, PostingContext } from './gl-posting-engine';
import { AccountingPeriodService } from './accounting-period-service';
import { EventService, EventCategory, InvoiceEvents } from './event-service';
import { InvoiceService, InvoiceWithLineItems } from './invoice-service';
import { db as globalDb, type ContextualDatabase } from '@glapi/database';
import { approvalInstances, approvalActions } from '@glapi/database/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export interface InvoicePostingServiceOptions {
  db?: ContextualDatabase;
}

// ============================================================================
// Types
// ============================================================================

/**
 * Invoice posting policy configuration
 */
export interface InvoicePostingPolicy {
  /** Whether approval is required before posting */
  requiresApproval: boolean;
  /** Approval threshold - amounts above this require approval */
  approvalThreshold?: number;
  /** Roles that can approve invoices */
  approverRoles?: string[];
  /** Whether to auto-post after approval */
  autoPostAfterApproval: boolean;
  /** Default AR (Accounts Receivable) account ID */
  defaultArAccountId: string;
  /** Default revenue account ID */
  defaultRevenueAccountId: string;
  /** Default tax liability account ID */
  defaultTaxAccountId?: string;
}

/**
 * Invoice posting request
 */
export interface PostInvoiceRequest {
  invoiceId: string;
  /** Force posting without approval (requires override permission) */
  forcePost?: boolean;
  /** Override posting date (defaults to invoice date) */
  postingDate?: string | Date;
  /** Custom memo for GL entry */
  memo?: string;
}

/**
 * Invoice approval request
 */
export interface ApproveInvoiceRequest {
  invoiceId: string;
  action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
  comments?: string;
}

/**
 * Result of invoice posting operation
 */
export interface InvoicePostingResult {
  invoice: InvoiceWithLineItems;
  glPostingResult?: GlPostingResult;
  approvalRequired: boolean;
  approvalInstanceId?: string;
  posted: boolean;
  events: string[];
}

// ============================================================================
// Invoice Posting Service
// ============================================================================

/**
 * Service that orchestrates invoice finalization, approval workflow, and GL posting.
 *
 * Flow:
 * 1. Invoice is finalized (status: draft -> sent)
 * 2. Check if approval is required based on policy
 * 3. If approval required, create approval instance and wait
 * 4. Once approved (or if no approval needed), generate GL entries
 * 5. Post GL transaction to ledger
 * 6. Update invoice with GL transaction reference
 * 7. Emit events for audit trail
 */
export class InvoicePostingService extends BaseService {
  private db: ContextualDatabase;
  private glPostingEngine: GlPostingEngine;
  private periodService: AccountingPeriodService;
  private eventService: EventService;
  private invoiceService: InvoiceService;

  constructor(context: ServiceContext = {}, options: InvoicePostingServiceOptions = {}) {
    super(context);
    this.db = options.db ?? globalDb;
    this.glPostingEngine = new GlPostingEngine(context);
    this.periodService = new AccountingPeriodService(context, { db: options.db });
    this.eventService = new EventService(context);
    this.invoiceService = new InvoiceService(context, { db: options.db });
  }

  /**
   * Finalize and post an invoice to the GL
   * This is the main entry point for invoice posting
   */
  async finalizeAndPost(
    request: PostInvoiceRequest,
    policy: InvoicePostingPolicy
  ): Promise<InvoicePostingResult> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Start correlation for event tracking
    const correlationId = this.eventService.startCorrelation();
    const emittedEvents: string[] = [];

    // Get the invoice
    const invoice = await this.invoiceService.getInvoiceById(request.invoiceId);
    if (!invoice) {
      throw new ServiceError('Invoice not found', 'NOT_FOUND', 404);
    }

    // Validate invoice can be posted
    this.validateInvoiceForPosting(invoice);

    // Check if approval is required
    const approvalRequired = this.checkApprovalRequired(invoice, policy, request.forcePost);

    if (approvalRequired) {
      // Create approval instance and submit for approval
      const approvalInstanceId = await this.submitForApproval(
        invoice,
        policy,
        userId,
        organizationId
      );

      // Emit submitted for approval event
      await this.emitInvoiceEvent(
        InvoiceEvents.SUBMITTED_FOR_APPROVAL,
        invoice,
        correlationId,
        { approvalInstanceId }
      );
      emittedEvents.push(InvoiceEvents.SUBMITTED_FOR_APPROVAL);

      return {
        invoice,
        approvalRequired: true,
        approvalInstanceId,
        posted: false,
        events: emittedEvents,
      };
    }

    // No approval required - proceed with posting
    return this.executePosting(invoice, request, policy, correlationId, emittedEvents);
  }

  /**
   * Process approval action and potentially trigger posting
   */
  async processApproval(
    request: ApproveInvoiceRequest,
    policy: InvoicePostingPolicy
  ): Promise<InvoicePostingResult> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const correlationId = this.eventService.startCorrelation();
    const emittedEvents: string[] = [];

    // Get the invoice
    const invoice = await this.invoiceService.getInvoiceById(request.invoiceId);
    if (!invoice) {
      throw new ServiceError('Invoice not found', 'NOT_FOUND', 404);
    }

    // Get pending approval instance
    const [approvalInstance] = await this.db
      .select()
      .from(approvalInstances)
      .where(
        and(
          eq(approvalInstances.organizationId, organizationId),
          eq(approvalInstances.entityType, 'INVOICE'),
          eq(approvalInstances.entityId, request.invoiceId),
          eq(approvalInstances.status, 'pending')
        )
      )
      .limit(1);

    if (!approvalInstance) {
      throw new ServiceError(
        'No pending approval found for this invoice',
        'NO_PENDING_APPROVAL',
        400
      );
    }

    // Record the approval action
    await this.db.insert(approvalActions).values({
      approvalInstanceId: approvalInstance.id,
      actionType: request.action,
      actorId: userId,
      stepNumber: approvalInstance.currentStep || 1,
      comments: request.comments,
    });

    if (request.action === 'APPROVE') {
      // Update approval instance status
      await this.db
        .update(approvalInstances)
        .set({
          status: 'approved',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(approvalInstances.id, approvalInstance.id));

      // Emit approved event
      await this.emitInvoiceEvent(InvoiceEvents.APPROVED, invoice, correlationId, {
        approvalInstanceId: approvalInstance.id,
        approvedBy: userId,
        comments: request.comments,
      });
      emittedEvents.push(InvoiceEvents.APPROVED);

      // Auto-post if configured
      if (policy.autoPostAfterApproval) {
        return this.executePosting(
          invoice,
          { invoiceId: request.invoiceId },
          policy,
          correlationId,
          emittedEvents
        );
      }

      return {
        invoice,
        approvalRequired: true,
        approvalInstanceId: approvalInstance.id,
        posted: false,
        events: emittedEvents,
      };
    } else if (request.action === 'REJECT') {
      // Update approval instance status
      await this.db
        .update(approvalInstances)
        .set({
          status: 'rejected',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(approvalInstances.id, approvalInstance.id));

      // Emit rejected event
      await this.emitInvoiceEvent(InvoiceEvents.REJECTED, invoice, correlationId, {
        approvalInstanceId: approvalInstance.id,
        rejectedBy: userId,
        reason: request.comments,
      });
      emittedEvents.push(InvoiceEvents.REJECTED);

      return {
        invoice,
        approvalRequired: true,
        approvalInstanceId: approvalInstance.id,
        posted: false,
        events: emittedEvents,
      };
    }

    // REQUEST_INFO - just record the action
    return {
      invoice,
      approvalRequired: true,
      approvalInstanceId: approvalInstance.id,
      posted: false,
      events: emittedEvents,
    };
  }

  /**
   * Get approval status for an invoice
   */
  async getApprovalStatus(invoiceId: string): Promise<{
    hasApproval: boolean;
    status: string | null;
    approvalInstanceId: string | null;
    actions: Array<{
      actionType: string;
      actorId: string | null;
      comments: string | null;
      createdAt: Date;
    }>;
  }> {
    const organizationId = this.requireOrganizationContext();

    const [approvalInstance] = await this.db
      .select()
      .from(approvalInstances)
      .where(
        and(
          eq(approvalInstances.organizationId, organizationId),
          eq(approvalInstances.entityType, 'INVOICE'),
          eq(approvalInstances.entityId, invoiceId)
        )
      )
      .limit(1);

    if (!approvalInstance) {
      return {
        hasApproval: false,
        status: null,
        approvalInstanceId: null,
        actions: [],
      };
    }

    const actions = await this.db
      .select({
        actionType: approvalActions.actionType,
        actorId: approvalActions.actorId,
        comments: approvalActions.comments,
        createdAt: approvalActions.createdAt,
      })
      .from(approvalActions)
      .where(eq(approvalActions.approvalInstanceId, approvalInstance.id));

    return {
      hasApproval: true,
      status: approvalInstance.status,
      approvalInstanceId: approvalInstance.id,
      actions,
    };
  }

  /**
   * Execute the GL posting for an invoice
   */
  private async executePosting(
    invoice: InvoiceWithLineItems,
    request: PostInvoiceRequest,
    policy: InvoicePostingPolicy,
    correlationId: string,
    emittedEvents: string[]
  ): Promise<InvoicePostingResult> {
    const organizationId = this.requireOrganizationContext();

    try {
      // Get accounting period for the posting date
      const postingDate = request.postingDate
        ? typeof request.postingDate === 'string'
          ? request.postingDate
          : request.postingDate.toISOString().split('T')[0]
        : invoice.invoiceDate;

      const period = await this.periodService.findPeriodForDate(postingDate);
      if (!period) {
        throw new ServiceError(
          'No accounting period found for posting date',
          'NO_PERIOD',
          400
        );
      }

      // Build posting context
      const postingContext = this.buildPostingContext(
        invoice,
        policy,
        period.id,
        request.memo
      );

      // Generate GL entries
      const glPostingResult = await this.glPostingEngine.generateGlEntries(postingContext);

      // Update invoice status to sent (if not already)
      if (invoice.status === 'draft') {
        await this.invoiceService.sendInvoice(invoice.id);
      }

      // Emit posted event
      await this.emitInvoiceEvent(InvoiceEvents.POSTED, invoice, correlationId, {
        glTransactionId: glPostingResult.glTransaction.id,
        totalAmount: invoice.totalAmount,
        postingDate,
      });
      emittedEvents.push(InvoiceEvents.POSTED);

      return {
        invoice,
        glPostingResult,
        approvalRequired: false,
        posted: true,
        events: emittedEvents,
      };
    } catch (error) {
      // Emit posting failed event
      await this.emitInvoiceEvent(InvoiceEvents.POSTING_FAILED, invoice, correlationId, {
        error: error instanceof Error ? error.message : String(error),
        errorCode: error instanceof ServiceError ? error.code : 'UNKNOWN_ERROR',
      });
      emittedEvents.push(InvoiceEvents.POSTING_FAILED);

      throw error;
    }
  }

  /**
   * Validate invoice can be posted
   */
  private validateInvoiceForPosting(invoice: InvoiceWithLineItems): void {
    if (invoice.status === 'void') {
      throw new ServiceError('Cannot post voided invoice', 'INVOICE_VOIDED', 400);
    }

    if (invoice.status === 'cancelled') {
      throw new ServiceError('Cannot post cancelled invoice', 'INVOICE_CANCELLED', 400);
    }

    const totalAmount = parseFloat(invoice.totalAmount);
    if (totalAmount <= 0) {
      throw new ServiceError('Invoice total must be positive', 'INVALID_AMOUNT', 400);
    }

    if (!invoice.lineItems || invoice.lineItems.length === 0) {
      throw new ServiceError('Invoice must have at least one line item', 'NO_LINE_ITEMS', 400);
    }
  }

  /**
   * Check if approval is required based on policy
   */
  private checkApprovalRequired(
    invoice: InvoiceWithLineItems,
    policy: InvoicePostingPolicy,
    forcePost?: boolean
  ): boolean {
    if (forcePost) {
      return false; // Override approval requirement
    }

    if (!policy.requiresApproval) {
      return false;
    }

    // Check threshold
    if (policy.approvalThreshold !== undefined) {
      const totalAmount = parseFloat(invoice.totalAmount);
      if (totalAmount < policy.approvalThreshold) {
        return false; // Below threshold, no approval needed
      }
    }

    return true;
  }

  /**
   * Submit invoice for approval
   */
  private async submitForApproval(
    invoice: InvoiceWithLineItems,
    policy: InvoicePostingPolicy,
    userId: string,
    organizationId: string
  ): Promise<string> {
    const approvalInstanceId = uuidv4();

    await this.db.insert(approvalInstances).values({
      id: approvalInstanceId,
      organizationId,
      workflowType: 'INVOICE_POSTING',
      entityType: 'INVOICE',
      entityId: invoice.id,
      documentId: invoice.invoiceNumber,
      status: 'pending',
      currentStep: 1,
      totalSteps: 1,
      submittedBy: userId,
      submittedAt: new Date(),
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount,
        entityId: invoice.entityId,
        policy: {
          threshold: policy.approvalThreshold,
          approverRoles: policy.approverRoles,
        },
      },
    });

    return approvalInstanceId;
  }

  /**
   * Build posting context for GL posting engine
   */
  private buildPostingContext(
    invoice: InvoiceWithLineItems,
    policy: InvoicePostingPolicy,
    periodId: string,
    memo?: string
  ): PostingContext {
    // Convert invoice to business transaction format (partial for posting context)
    const businessTransaction = {
      id: `invoice-${invoice.id}`,
      transactionNumber: invoice.invoiceNumber,
      transactionTypeId: 'INVOICE', // Would be looked up in production
      subsidiaryId: invoice.organizationId, // Using org as subsidiary for now
      entityId: invoice.entityId,
      entityType: 'CUSTOMER',
      transactionDate: invoice.invoiceDate,
      currencyCode: 'USD', // Would come from invoice in production
      exchangeRate: '1',
      subtotalAmount: invoice.subtotal,
      taxAmount: invoice.taxAmount || '0',
      discountAmount: '0',
      totalAmount: invoice.totalAmount,
      baseTotalAmount: invoice.totalAmount,
      memo: memo || `Invoice ${invoice.invoiceNumber}`,
      status: 'APPROVED',
      versionNumber: 1,
    } as BusinessTransaction;

    // Convert invoice lines to business transaction lines (partial for posting context)
    const businessTransactionLines = (invoice.lineItems || []).map(
      (line, index) => ({
        id: line.id,
        businessTransactionId: `invoice-${invoice.id}`,
        lineNumber: index + 1,
        lineType: 'ITEM' as const,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineAmount: line.amount,
        totalLineAmount: line.amount,
        taxAmount: '0',
        discountAmount: '0',
      })
    ) as BusinessTransactionLine[];

    // Build posting rules for invoice
    const postingRules: GlPostingRule[] = this.buildInvoicePostingRules(invoice, policy);

    return {
      businessTransaction,
      businessTransactionLines,
      postingRules,
      baseCurrencyCode: 'USD', // Would come from organization settings
      periodId,
    };
  }

  /**
   * Build posting rules for an invoice
   * Standard double-entry: Debit AR, Credit Revenue (and Tax if applicable)
   */
  private buildInvoicePostingRules(
    invoice: InvoiceWithLineItems,
    policy: InvoicePostingPolicy
  ): GlPostingRule[] {
    const rules: GlPostingRule[] = [];

    // Rule 1: Debit AR for subtotal + tax
    rules.push({
      transactionTypeId: 'INVOICE',
      ruleName: 'Invoice AR Debit',
      sequenceNumber: 10,
      lineType: 'ITEM',
      debitAccountId: policy.defaultArAccountId,
      amountFormula: 'line_amount',
      descriptionTemplate: 'AR - {transaction.number} - {line.description}',
      isActive: true,
      effectiveDate: new Date().toISOString().split('T')[0],
    });

    // Rule 2: Credit Revenue
    rules.push({
      transactionTypeId: 'INVOICE',
      ruleName: 'Invoice Revenue Credit',
      sequenceNumber: 20,
      lineType: 'ITEM',
      creditAccountId: policy.defaultRevenueAccountId,
      amountFormula: 'line_amount',
      descriptionTemplate: 'Revenue - {transaction.number} - {line.description}',
      isActive: true,
      effectiveDate: new Date().toISOString().split('T')[0],
    });

    // Rule 3: Tax if applicable
    const taxAmount = parseFloat(invoice.taxAmount || '0');
    if (taxAmount > 0 && policy.defaultTaxAccountId) {
      rules.push({
        transactionTypeId: 'INVOICE',
        ruleName: 'Invoice Tax Credit',
        sequenceNumber: 30,
        lineType: 'TAX',
        debitAccountId: policy.defaultArAccountId,
        creditAccountId: policy.defaultTaxAccountId,
        amountFormula: 'tax_amount',
        descriptionTemplate: 'Tax - {transaction.number}',
        isActive: true,
        effectiveDate: new Date().toISOString().split('T')[0],
      });
    }

    return rules;
  }

  /**
   * Emit invoice event to event store
   */
  private async emitInvoiceEvent(
    eventType: string,
    invoice: InvoiceWithLineItems,
    correlationId: string,
    additionalData?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.eventService.emit({
        eventType,
        eventCategory: EventCategory.TRANSACTION,
        aggregateId: invoice.id,
        aggregateType: 'Invoice',
        correlationId,
        data: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          entityId: invoice.entityId,
          status: invoice.status,
          totalAmount: invoice.totalAmount,
          ...additionalData,
        },
      });
    } catch (error) {
      // Log but don't fail the main operation
      console.error(`Failed to emit ${eventType} event:`, error);
    }
  }

  /**
   * Get posting policy for organization
   * In production, this would be loaded from organization settings
   */
  static getDefaultPolicy(): InvoicePostingPolicy {
    return {
      requiresApproval: true,
      approvalThreshold: 10000, // Require approval for invoices over $10,000
      autoPostAfterApproval: true,
      defaultArAccountId: 'ar-account-id', // Would be configured per org
      defaultRevenueAccountId: 'revenue-account-id', // Would be configured per org
      defaultTaxAccountId: 'tax-liability-account-id', // Would be configured per org
    };
  }
}
