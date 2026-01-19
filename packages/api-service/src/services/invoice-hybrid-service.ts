/**
 * Invoice Hybrid Service
 *
 * Manages invoices using the hybrid transaction model.
 * Uses transaction_headers + transaction_lines with invoice_ext + invoice_line_ext.
 */

import { BaseTransactionService } from './base-transaction-service';
import { ServiceContext, ServiceError, PaginatedResult, PaginationParams } from '../types';
import {
  TransactionTypeCode,
  TransactionTypeCodeValue,
  TransactionFilters,
  CreateTransactionLineInput,
} from '../types/transaction.types';
import { EventCategoryType } from '@glapi/database';
import { db } from '@glapi/database';
import {
  transactionHeaders,
  transactionLines,
  TransactionHeader,
  TransactionLine,
  invoiceExt,
  invoiceLineExt,
  InvoiceExtRecord,
  InvoiceLineExtRecord,
  NewInvoiceExtRecord,
  HybridInvoiceStatus,
  HybridInvoiceStatusValue,
  salesOrderExt,
  entities,
  accounts,
} from '@glapi/database/schema';
import { eq, and, desc, asc, sql, inArray, gte, lte, or, ilike } from 'drizzle-orm';
import Decimal from 'decimal.js';

// ============================================================================
// TYPES
// ============================================================================

export interface InvoiceHeader {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  transactionType: TransactionTypeCodeValue;
  transactionNumber: string;
  customerId: string;
  customerName?: string;
  invoiceDate: string;
  status: HybridInvoiceStatusValue;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  currencyCode: string;
  exchangeRate: string;
  memo?: string;
  internalNotes?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface InvoiceExtension {
  subscriptionId?: string;
  salesOrderId?: string;
  dueDate?: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  paidAmount: string;
  balanceDue: string;
  arAccountId?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
}

export interface InvoiceLine {
  id: string;
  transactionId: string;
  lineNumber: number;
  itemId?: string;
  itemName: string;
  itemDescription?: string;
  quantity: string;
  unitOfMeasure?: string;
  unitPrice: string;
  amount: string;
  taxAmount: string;
  accountId?: string;
  departmentId?: string;
  locationId?: string;
  classId?: string;
  projectId?: string;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineExtension {
  subscriptionItemId?: string;
  salesOrderLineId?: string;
  revenueAccountId?: string;
  deferredRevenueAccountId?: string;
}

export interface InvoiceLineWithExtension {
  line: InvoiceLine;
  extension: InvoiceLineExtension;
}

export interface InvoiceWithDetails {
  header: InvoiceHeader;
  extension: InvoiceExtension;
  lines: InvoiceLineWithExtension[];
}

export interface CreateInvoiceInput {
  subsidiaryId: string;
  customerId: string;
  customerName?: string;
  invoiceDate: string | Date;
  dueDate?: string | Date;
  subscriptionId?: string;
  salesOrderId?: string;
  billingPeriodStart?: string | Date;
  billingPeriodEnd?: string | Date;
  arAccountId?: string;
  currencyCode?: string;
  exchangeRate?: number;
  memo?: string;
  internalNotes?: string;
  lines: CreateInvoiceLineInput[];
}

export interface CreateInvoiceLineInput extends CreateTransactionLineInput {
  subscriptionItemId?: string;
  salesOrderLineId?: string;
  revenueAccountId?: string;
  deferredRevenueAccountId?: string;
}

export interface UpdateInvoiceInput {
  invoiceDate?: string | Date;
  dueDate?: string | Date;
  arAccountId?: string;
  memo?: string;
  internalNotes?: string;
}

export interface InvoiceFilters extends TransactionFilters {
  subscriptionId?: string;
  salesOrderId?: string;
  overdue?: boolean;
}

export interface InvoiceAgingReport {
  asOfDate: string;
  current: string;
  thirtyDays: string;
  sixtyDays: string;
  ninetyPlusDays: string;
  total: string;
  invoiceCount: number;
  details: Array<{
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
    customerName?: string;
    invoiceDate: string;
    dueDate?: string;
    balanceDue: string;
    daysOverdue: number;
    bucket: 'current' | '30' | '60' | '90+';
  }>;
}

// ============================================================================
// STATUS TRANSITIONS
// ============================================================================

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  [HybridInvoiceStatus.DRAFT]: [
    HybridInvoiceStatus.PENDING,
    HybridInvoiceStatus.SENT,
    HybridInvoiceStatus.VOIDED,
    HybridInvoiceStatus.CANCELLED,
  ],
  [HybridInvoiceStatus.PENDING]: [
    HybridInvoiceStatus.SENT,
    HybridInvoiceStatus.VOIDED,
    HybridInvoiceStatus.CANCELLED,
  ],
  [HybridInvoiceStatus.SENT]: [
    HybridInvoiceStatus.PARTIALLY_PAID,
    HybridInvoiceStatus.PAID,
    HybridInvoiceStatus.OVERDUE,
    HybridInvoiceStatus.VOIDED,
  ],
  [HybridInvoiceStatus.PARTIALLY_PAID]: [
    HybridInvoiceStatus.PAID,
    HybridInvoiceStatus.OVERDUE,
    HybridInvoiceStatus.VOIDED,
  ],
  [HybridInvoiceStatus.OVERDUE]: [
    HybridInvoiceStatus.PARTIALLY_PAID,
    HybridInvoiceStatus.PAID,
    HybridInvoiceStatus.VOIDED,
  ],
  [HybridInvoiceStatus.PAID]: [],
  [HybridInvoiceStatus.VOIDED]: [],
  [HybridInvoiceStatus.CANCELLED]: [],
};

// ============================================================================
// SERVICE
// ============================================================================

export class InvoiceHybridService extends BaseTransactionService {
  protected transactionType = TransactionTypeCode.INVOICE;
  protected eventCategory: EventCategoryType = 'TRANSACTION';

  constructor(context: ServiceContext = {}) {
    super(context);
  }

  // ==========================================================================
  // LIST OPERATIONS
  // ==========================================================================

  /**
   * List invoices with filters
   */
  async listInvoices(
    params: PaginationParams = {},
    filters: InvoiceFilters = {}
  ): Promise<PaginatedResult<InvoiceWithDetails>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(params);

    // Build where conditions
    const headerConditions = [
      eq(transactionHeaders.organizationId, organizationId),
      eq(transactionHeaders.transactionType, this.transactionType),
    ];

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        headerConditions.push(inArray(transactionHeaders.status, filters.status));
      } else {
        headerConditions.push(eq(transactionHeaders.status, filters.status));
      }
    }

    if (filters.entityId) {
      headerConditions.push(eq(transactionHeaders.entityId, filters.entityId));
    }

    if (filters.subsidiaryId) {
      headerConditions.push(eq(transactionHeaders.subsidiaryId, filters.subsidiaryId));
    }

    if (filters.dateFrom) {
      const dateFrom = this.toDateString(filters.dateFrom);
      headerConditions.push(gte(transactionHeaders.transactionDate, dateFrom));
    }

    if (filters.dateTo) {
      const dateTo = this.toDateString(filters.dateTo);
      headerConditions.push(lte(transactionHeaders.transactionDate, dateTo));
    }

    if (filters.search) {
      headerConditions.push(
        or(
          ilike(transactionHeaders.transactionNumber, `%${filters.search}%`),
          ilike(transactionHeaders.entityName, `%${filters.search}%`),
          ilike(transactionHeaders.memo, `%${filters.search}%`)
        )!
      );
    }

    // Count total
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactionHeaders)
      .where(and(...headerConditions));
    const total = Number(countResult[0]?.count || 0);

    // Fetch headers with extension
    const results = await db
      .select({
        header: transactionHeaders,
        extension: invoiceExt,
      })
      .from(transactionHeaders)
      .innerJoin(invoiceExt, eq(transactionHeaders.id, invoiceExt.transactionId))
      .where(and(...headerConditions))
      .orderBy(desc(transactionHeaders.createdAt))
      .limit(take)
      .offset(skip);

    // Apply additional filters
    let invoices = results;

    if (filters.subscriptionId) {
      invoices = invoices.filter((i) => i.extension.subscriptionId === filters.subscriptionId);
    }

    if (filters.salesOrderId) {
      invoices = invoices.filter((i) => i.extension.salesOrderId === filters.salesOrderId);
    }

    if (filters.overdue) {
      const today = new Date().toISOString().split('T')[0];
      invoices = invoices.filter((i) =>
        i.extension.dueDate &&
        i.extension.dueDate < today &&
        new Decimal(i.extension.balanceDue || 0).greaterThan(0)
      );
    }

    // Fetch lines for each invoice
    const data = await Promise.all(
      invoices.map(async (i) => {
        const lines = await this.getLinesWithExtension(i.header.id);
        return this.transformToResponse(i.header, i.extension, lines);
      })
    );

    return this.createPaginatedResult(data, total, page, limit);
  }

  // ==========================================================================
  // GET OPERATIONS
  // ==========================================================================

  /**
   * Get an invoice by ID
   */
  async getInvoiceById(id: string): Promise<InvoiceWithDetails> {
    const organizationId = this.requireOrganizationContext();

    const [result] = await db
      .select({
        header: transactionHeaders,
        extension: invoiceExt,
      })
      .from(transactionHeaders)
      .innerJoin(invoiceExt, eq(transactionHeaders.id, invoiceExt.transactionId))
      .where(
        and(
          eq(transactionHeaders.id, id),
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, this.transactionType)
        )
      )
      .limit(1);

    if (!result) {
      throw new ServiceError('Invoice not found', 'NOT_FOUND', 404);
    }

    const lines = await this.getLinesWithExtension(id);

    return this.transformToResponse(result.header, result.extension, lines);
  }

  /**
   * Get an invoice by transaction number
   */
  async getInvoiceByNumber(transactionNumber: string): Promise<InvoiceWithDetails> {
    const organizationId = this.requireOrganizationContext();

    const [result] = await db
      .select({
        header: transactionHeaders,
        extension: invoiceExt,
      })
      .from(transactionHeaders)
      .innerJoin(invoiceExt, eq(transactionHeaders.id, invoiceExt.transactionId))
      .where(
        and(
          eq(transactionHeaders.transactionNumber, transactionNumber),
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, this.transactionType)
        )
      )
      .limit(1);

    if (!result) {
      throw new ServiceError('Invoice not found', 'NOT_FOUND', 404);
    }

    const lines = await this.getLinesWithExtension(result.header.id);

    return this.transformToResponse(result.header, result.extension, lines);
  }

  // ==========================================================================
  // CREATE OPERATIONS
  // ==========================================================================

  /**
   * Create a new invoice
   */
  async createInvoice(input: CreateInvoiceInput): Promise<InvoiceWithDetails> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // Generate transaction number
    const transactionNumber = await this.generateTransactionNumber();

    // Calculate line totals
    const { lines, subtotal, taxTotal, totalAmount } = this.calculateLineTotals(input.lines);

    // Get customer name if not provided
    let customerName = input.customerName;
    if (!customerName) {
      const [customer] = await db
        .select({ name: entities.name })
        .from(entities)
        .where(eq(entities.id, input.customerId))
        .limit(1);
      customerName = customer?.name;
    }

    // Create header
    const header = await this.createHeader({
      subsidiaryId: input.subsidiaryId,
      transactionType: this.transactionType,
      transactionNumber,
      entityId: input.customerId,
      entityName: customerName,
      transactionDate: this.toDateString(input.invoiceDate),
      status: HybridInvoiceStatus.DRAFT,
      subtotal: subtotal.toFixed(4),
      taxAmount: taxTotal.toFixed(4),
      totalAmount: totalAmount.toFixed(4),
      currencyCode: input.currencyCode || 'USD',
      exchangeRate: String(input.exchangeRate || 1),
      memo: input.memo,
      internalNotes: input.internalNotes,
      createdBy: userId,
    });

    // Create extension
    await db.insert(invoiceExt).values({
      transactionId: header.id,
      subscriptionId: input.subscriptionId,
      salesOrderId: input.salesOrderId,
      dueDate: input.dueDate ? this.toDateString(input.dueDate) : null,
      billingPeriodStart: input.billingPeriodStart
        ? this.toDateString(input.billingPeriodStart)
        : null,
      billingPeriodEnd: input.billingPeriodEnd
        ? this.toDateString(input.billingPeriodEnd)
        : null,
      paidAmount: '0',
      balanceDue: totalAmount.toFixed(4),
      arAccountId: input.arAccountId,
    });

    // Create lines with extensions
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const originalLine = input.lines[i];

      // Create core line
      const [createdLine] = await db
        .insert(transactionLines)
        .values({
          transactionId: header.id,
          lineNumber: line.lineNumber || i + 1,
          itemId: line.itemId,
          itemName: line.itemName,
          itemDescription: line.itemDescription,
          quantity: String(line.quantity),
          unitOfMeasure: line.unitOfMeasure,
          unitPrice: String(line.unitPrice),
          amount: String(line.amount),
          taxAmount: String(line.taxAmount || 0),
          accountId: line.accountId,
          departmentId: line.departmentId,
          locationId: line.locationId,
          classId: line.classId,
          projectId: line.projectId,
          memo: line.memo,
        })
        .returning();

      // Create line extension
      await db.insert(invoiceLineExt).values({
        lineId: createdLine.id,
        subscriptionItemId: originalLine.subscriptionItemId,
        salesOrderLineId: originalLine.salesOrderLineId,
        revenueAccountId: originalLine.revenueAccountId,
        deferredRevenueAccountId: originalLine.deferredRevenueAccountId,
      });
    }

    // Emit event
    await this.emitEvent('INVOICE_CREATED', header.id, {
      invoiceNumber: transactionNumber,
      customerId: input.customerId,
      totalAmount,
      lineCount: lines.length,
    });

    return this.getInvoiceById(header.id);
  }

  // ==========================================================================
  // UPDATE OPERATIONS
  // ==========================================================================

  /**
   * Update an invoice (only in DRAFT status)
   */
  async updateInvoice(
    id: string,
    input: UpdateInvoiceInput
  ): Promise<InvoiceWithDetails> {
    const invoice = await this.getInvoiceById(id);

    if (invoice.header.status !== HybridInvoiceStatus.DRAFT) {
      throw new ServiceError(
        'Can only update invoices in DRAFT status',
        'INVALID_STATUS',
        400
      );
    }

    // Update header
    const headerUpdates: Record<string, unknown> = {};
    if (input.invoiceDate) {
      headerUpdates.transactionDate = this.toDateString(input.invoiceDate);
    }
    if (input.memo !== undefined) {
      headerUpdates.memo = input.memo;
    }
    if (input.internalNotes !== undefined) {
      headerUpdates.internalNotes = input.internalNotes;
    }

    if (Object.keys(headerUpdates).length > 0) {
      await this.updateHeader(id, headerUpdates);
    }

    // Update extension
    const extUpdates: Partial<NewInvoiceExtRecord> = {};
    if (input.dueDate !== undefined) {
      extUpdates.dueDate = input.dueDate ? this.toDateString(input.dueDate) : null;
    }
    if (input.arAccountId !== undefined) {
      extUpdates.arAccountId = input.arAccountId;
    }

    if (Object.keys(extUpdates).length > 0) {
      await db
        .update(invoiceExt)
        .set(extUpdates)
        .where(eq(invoiceExt.transactionId, id));
    }

    return this.getInvoiceById(id);
  }

  // ==========================================================================
  // STATUS OPERATIONS
  // ==========================================================================

  /**
   * Send an invoice to customer
   */
  async sendInvoice(id: string): Promise<InvoiceWithDetails> {
    const invoice = await this.getInvoiceById(id);

    this.validateStatusTransition(
      invoice.header.status,
      HybridInvoiceStatus.SENT,
      VALID_STATUS_TRANSITIONS
    );

    await this.updateStatus(id, HybridInvoiceStatus.SENT);

    // Emit event
    await this.emitEvent('INVOICE_SENT', id, {
      invoiceNumber: invoice.header.transactionNumber,
      customerId: invoice.header.customerId,
    });

    return this.getInvoiceById(id);
  }

  /**
   * Apply a payment to an invoice
   */
  async applyPayment(
    id: string,
    paymentAmount: number,
    discountTaken: number = 0
  ): Promise<InvoiceWithDetails> {
    const invoice = await this.getInvoiceById(id);

    // Can only apply payment to sent/partially paid/overdue invoices
    const payableStatuses: HybridInvoiceStatusValue[] = [
      HybridInvoiceStatus.SENT,
      HybridInvoiceStatus.PARTIALLY_PAID,
      HybridInvoiceStatus.OVERDUE,
    ];
    if (!payableStatuses.includes(invoice.header.status)) {
      throw new ServiceError(
        `Cannot apply payment to invoice in ${invoice.header.status} status`,
        'INVALID_STATUS',
        400
      );
    }

    const currentPaid = new Decimal(invoice.extension.paidAmount);
    const currentBalance = new Decimal(invoice.extension.balanceDue);
    const payment = new Decimal(paymentAmount);
    const discount = new Decimal(discountTaken);

    const newPaid = currentPaid.plus(payment).plus(discount);
    const newBalance = currentBalance.minus(payment).minus(discount);

    // Update extension
    await db
      .update(invoiceExt)
      .set({
        paidAmount: newPaid.toFixed(4),
        balanceDue: Decimal.max(newBalance, 0).toFixed(4),
      })
      .where(eq(invoiceExt.transactionId, id));

    // Update status based on balance
    let newStatus: HybridInvoiceStatusValue;
    if (newBalance.lessThanOrEqualTo(0)) {
      newStatus = HybridInvoiceStatus.PAID;
    } else {
      newStatus = HybridInvoiceStatus.PARTIALLY_PAID;
    }

    await this.updateStatus(id, newStatus);

    // Emit event
    await this.emitEvent('INVOICE_PAYMENT_APPLIED', id, {
      invoiceNumber: invoice.header.transactionNumber,
      paymentAmount,
      discountTaken,
      newBalance: Decimal.max(newBalance, 0).toNumber(),
      newStatus,
    });

    return this.getInvoiceById(id);
  }

  /**
   * Mark an invoice as overdue
   */
  async markOverdue(id: string): Promise<InvoiceWithDetails> {
    const invoice = await this.getInvoiceById(id);

    this.validateStatusTransition(
      invoice.header.status,
      HybridInvoiceStatus.OVERDUE,
      VALID_STATUS_TRANSITIONS
    );

    await this.updateStatus(id, HybridInvoiceStatus.OVERDUE);

    // Emit event
    await this.emitEvent('INVOICE_MARKED_OVERDUE', id, {
      invoiceNumber: invoice.header.transactionNumber,
      dueDate: invoice.extension.dueDate,
      balanceDue: invoice.extension.balanceDue,
    });

    return this.getInvoiceById(id);
  }

  /**
   * Void an invoice
   */
  async voidInvoice(id: string, reason: string): Promise<InvoiceWithDetails> {
    const userId = this.requireUserContext();
    const invoice = await this.getInvoiceById(id);

    this.validateStatusTransition(
      invoice.header.status,
      HybridInvoiceStatus.VOIDED,
      VALID_STATUS_TRANSITIONS
    );

    // Update status
    await this.updateStatus(id, HybridInvoiceStatus.VOIDED);

    // Update extension with void info
    await db
      .update(invoiceExt)
      .set({
        voidedAt: new Date(),
        voidedBy: userId,
        voidReason: reason,
      })
      .where(eq(invoiceExt.transactionId, id));

    // Emit event
    await this.emitEvent('INVOICE_VOIDED', id, {
      invoiceNumber: invoice.header.transactionNumber,
      voidedBy: userId,
      reason,
    });

    return this.getInvoiceById(id);
  }

  // ==========================================================================
  // REPORTING
  // ==========================================================================

  /**
   * Get invoice aging report
   */
  async getAgingReport(asOfDate: string | Date): Promise<InvoiceAgingReport> {
    const organizationId = this.requireOrganizationContext();
    const asOf = this.toDateString(asOfDate);
    const asOfDateObj = new Date(asOf);

    // Get all open invoices
    const invoices = await db
      .select({
        header: transactionHeaders,
        extension: invoiceExt,
      })
      .from(transactionHeaders)
      .innerJoin(invoiceExt, eq(transactionHeaders.id, invoiceExt.transactionId))
      .where(
        and(
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, this.transactionType),
          inArray(transactionHeaders.status, [
            HybridInvoiceStatus.SENT,
            HybridInvoiceStatus.PARTIALLY_PAID,
            HybridInvoiceStatus.OVERDUE,
          ])
        )
      );

    let current = new Decimal(0);
    let thirtyDays = new Decimal(0);
    let sixtyDays = new Decimal(0);
    let ninetyPlus = new Decimal(0);

    const details: InvoiceAgingReport['details'] = [];

    for (const inv of invoices) {
      const balance = new Decimal(inv.extension.balanceDue || 0);
      if (balance.lessThanOrEqualTo(0)) continue;

      const dueDate = inv.extension.dueDate
        ? new Date(inv.extension.dueDate)
        : new Date(inv.header.transactionDate);
      const daysOverdue = Math.max(
        0,
        Math.floor((asOfDateObj.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      );

      let bucket: 'current' | '30' | '60' | '90+';
      if (daysOverdue <= 0) {
        bucket = 'current';
        current = current.plus(balance);
      } else if (daysOverdue <= 30) {
        bucket = '30';
        thirtyDays = thirtyDays.plus(balance);
      } else if (daysOverdue <= 60) {
        bucket = '60';
        sixtyDays = sixtyDays.plus(balance);
      } else {
        bucket = '90+';
        ninetyPlus = ninetyPlus.plus(balance);
      }

      details.push({
        invoiceId: inv.header.id,
        invoiceNumber: inv.header.transactionNumber,
        customerId: inv.header.entityId,
        customerName: inv.header.entityName || undefined,
        invoiceDate: inv.header.transactionDate,
        dueDate: inv.extension.dueDate || undefined,
        balanceDue: balance.toFixed(2),
        daysOverdue,
        bucket,
      });
    }

    const total = current.plus(thirtyDays).plus(sixtyDays).plus(ninetyPlus);

    return {
      asOfDate: asOf,
      current: current.toFixed(2),
      thirtyDays: thirtyDays.toFixed(2),
      sixtyDays: sixtyDays.toFixed(2),
      ninetyPlusDays: ninetyPlus.toFixed(2),
      total: total.toFixed(2),
      invoiceCount: details.length,
      details,
    };
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  /**
   * Get lines with their extensions
   */
  private async getLinesWithExtension(
    transactionId: string
  ): Promise<Array<{ line: TransactionLine; extension: InvoiceLineExtRecord }>> {
    const results = await db
      .select({
        line: transactionLines,
        extension: invoiceLineExt,
      })
      .from(transactionLines)
      .innerJoin(invoiceLineExt, eq(transactionLines.id, invoiceLineExt.lineId))
      .where(eq(transactionLines.transactionId, transactionId))
      .orderBy(asc(transactionLines.lineNumber));

    return results;
  }

  /**
   * Transform database records to response format
   */
  private transformToResponse(
    header: TransactionHeader,
    extension: InvoiceExtRecord,
    lines: Array<{ line: TransactionLine; extension: InvoiceLineExtRecord }>
  ): InvoiceWithDetails {
    return {
      header: {
        id: header.id,
        organizationId: header.organizationId,
        subsidiaryId: header.subsidiaryId,
        transactionType: header.transactionType as TransactionTypeCodeValue,
        transactionNumber: header.transactionNumber,
        customerId: header.entityId,
        customerName: header.entityName || undefined,
        invoiceDate: header.transactionDate,
        status: header.status as HybridInvoiceStatusValue,
        subtotal: header.subtotal || '0',
        taxAmount: header.taxAmount || '0',
        totalAmount: header.totalAmount || '0',
        currencyCode: header.currencyCode || 'USD',
        exchangeRate: header.exchangeRate || '1',
        memo: header.memo || undefined,
        internalNotes: header.internalNotes || undefined,
        createdAt: header.createdAt.toISOString(),
        createdBy: header.createdBy,
        updatedAt: header.updatedAt.toISOString(),
        updatedBy: header.updatedBy || undefined,
      },
      extension: {
        subscriptionId: extension.subscriptionId || undefined,
        salesOrderId: extension.salesOrderId || undefined,
        dueDate: extension.dueDate || undefined,
        billingPeriodStart: extension.billingPeriodStart || undefined,
        billingPeriodEnd: extension.billingPeriodEnd || undefined,
        paidAmount: extension.paidAmount || '0',
        balanceDue: extension.balanceDue || '0',
        arAccountId: extension.arAccountId || undefined,
        voidedAt: extension.voidedAt?.toISOString() || undefined,
        voidedBy: extension.voidedBy || undefined,
        voidReason: extension.voidReason || undefined,
      },
      lines: lines.map(({ line, extension: lineExt }) => ({
        line: {
          id: line.id,
          transactionId: line.transactionId,
          lineNumber: line.lineNumber,
          itemId: line.itemId || undefined,
          itemName: line.itemName,
          itemDescription: line.itemDescription || undefined,
          quantity: line.quantity,
          unitOfMeasure: line.unitOfMeasure || undefined,
          unitPrice: line.unitPrice,
          amount: line.amount,
          taxAmount: line.taxAmount || '0',
          accountId: line.accountId || undefined,
          departmentId: line.departmentId || undefined,
          locationId: line.locationId || undefined,
          classId: line.classId || undefined,
          projectId: line.projectId || undefined,
          memo: line.memo || undefined,
          createdAt: line.createdAt.toISOString(),
          updatedAt: line.updatedAt.toISOString(),
        },
        extension: {
          subscriptionItemId: lineExt.subscriptionItemId || undefined,
          salesOrderLineId: lineExt.salesOrderLineId || undefined,
          revenueAccountId: lineExt.revenueAccountId || undefined,
          deferredRevenueAccountId: lineExt.deferredRevenueAccountId || undefined,
        },
      })),
    };
  }
}
