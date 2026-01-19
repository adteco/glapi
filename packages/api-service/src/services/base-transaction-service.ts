/**
 * Base Transaction Service
 *
 * Provides common CRUD operations for the hybrid transaction model.
 * Handles operations on transaction_headers and transaction_lines tables
 * with type-specific extension support.
 */

import { BaseService } from './base-service';
import { EventService } from './event-service';
import {
  ServiceContext,
  ServiceError,
  PaginatedResult,
  PaginationParams,
} from '../types';
import {
  BaseTransactionHeader,
  BaseTransactionLine,
  TransactionTypeCodeValue,
  TransactionNumberPrefix,
  TransactionFilters,
  CreateTransactionLineInput,
  LineCalculationResult,
} from '../types/transaction.types';
import { EventCategoryType } from '@glapi/database';
import { db } from '@glapi/database';
import {
  transactionHeaders,
  transactionLines,
  TransactionHeader,
  TransactionLine,
  NewTransactionHeader,
  NewTransactionLine,
} from '@glapi/database/schema';
import { eq, and, desc, asc, sql, inArray, gte, lte, or, ilike } from 'drizzle-orm';
import Decimal from 'decimal.js';

// ============================================================================
// Base Transaction Service
// ============================================================================

export abstract class BaseTransactionService extends BaseService {
  protected eventService: EventService;
  protected abstract transactionType: TransactionTypeCodeValue;
  protected abstract eventCategory: EventCategoryType;

  constructor(context: ServiceContext = {}) {
    super(context);
    this.eventService = new EventService(context);
  }

  // ==========================================================================
  // TRANSACTION NUMBER GENERATION
  // ==========================================================================

  /**
   * Generate a unique transaction number for the given type
   */
  protected async generateTransactionNumber(
    transactionType: TransactionTypeCodeValue = this.transactionType
  ): Promise<string> {
    const organizationId = this.requireOrganizationContext();
    const year = new Date().getFullYear();
    const prefix = TransactionNumberPrefix[transactionType];

    const result = await db.execute(sql`
      SELECT COUNT(*) + 1 as seq
      FROM transaction_headers
      WHERE organization_id = ${organizationId}
        AND transaction_type = ${transactionType}
        AND transaction_number LIKE ${`${prefix}-${year}-%`}
    `);
    const seq = String((result.rows[0] as { seq: number }).seq).padStart(6, '0');
    return `${prefix}-${year}-${seq}`;
  }

  // ==========================================================================
  // HEADER CRUD OPERATIONS
  // ==========================================================================

  /**
   * Create a transaction header
   */
  protected async createHeader(
    data: Omit<NewTransactionHeader, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>
  ): Promise<TransactionHeader> {
    const organizationId = this.requireOrganizationContext();

    const [header] = await db
      .insert(transactionHeaders)
      .values({
        ...data,
        organizationId,
      })
      .returning();

    return header;
  }

  /**
   * Get a transaction header by ID
   */
  protected async getHeaderById(id: string): Promise<TransactionHeader | null> {
    const organizationId = this.requireOrganizationContext();

    const [header] = await db
      .select()
      .from(transactionHeaders)
      .where(
        and(
          eq(transactionHeaders.id, id),
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, this.transactionType)
        )
      )
      .limit(1);

    return header || null;
  }

  /**
   * Get a transaction header by transaction number
   */
  protected async getHeaderByNumber(transactionNumber: string): Promise<TransactionHeader | null> {
    const organizationId = this.requireOrganizationContext();

    const [header] = await db
      .select()
      .from(transactionHeaders)
      .where(
        and(
          eq(transactionHeaders.transactionNumber, transactionNumber),
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, this.transactionType)
        )
      )
      .limit(1);

    return header || null;
  }

  /**
   * Update a transaction header
   */
  protected async updateHeader(
    id: string,
    data: Partial<Omit<NewTransactionHeader, 'id' | 'organizationId' | 'transactionType' | 'createdAt' | 'createdBy'>>
  ): Promise<TransactionHeader> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const [header] = await db
      .update(transactionHeaders)
      .set({
        ...data,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(transactionHeaders.id, id),
          eq(transactionHeaders.organizationId, organizationId),
          eq(transactionHeaders.transactionType, this.transactionType)
        )
      )
      .returning();

    if (!header) {
      throw new ServiceError('Transaction not found', 'NOT_FOUND', 404);
    }

    return header;
  }

  /**
   * Update transaction status
   */
  protected async updateStatus(
    id: string,
    newStatus: string
  ): Promise<TransactionHeader> {
    return this.updateHeader(id, { status: newStatus });
  }

  // ==========================================================================
  // LINE CRUD OPERATIONS
  // ==========================================================================

  /**
   * Create transaction lines
   */
  protected async createLines(
    transactionId: string,
    lines: Array<Omit<NewTransactionLine, 'id' | 'transactionId' | 'createdAt' | 'updatedAt'>>
  ): Promise<TransactionLine[]> {
    if (lines.length === 0) {
      return [];
    }

    const createdLines: TransactionLine[] = [];

    for (const line of lines) {
      const [created] = await db
        .insert(transactionLines)
        .values({
          ...line,
          transactionId,
        })
        .returning();
      createdLines.push(created);
    }

    return createdLines;
  }

  /**
   * Get lines for a transaction
   */
  protected async getLinesByTransactionId(transactionId: string): Promise<TransactionLine[]> {
    return db
      .select()
      .from(transactionLines)
      .where(eq(transactionLines.transactionId, transactionId))
      .orderBy(asc(transactionLines.lineNumber));
  }

  /**
   * Get a single line by ID
   */
  protected async getLineById(lineId: string): Promise<TransactionLine | null> {
    const [line] = await db
      .select()
      .from(transactionLines)
      .where(eq(transactionLines.id, lineId))
      .limit(1);

    return line || null;
  }

  /**
   * Update a transaction line
   */
  protected async updateLine(
    lineId: string,
    data: Partial<Omit<NewTransactionLine, 'id' | 'transactionId' | 'createdAt'>>
  ): Promise<TransactionLine> {
    const [line] = await db
      .update(transactionLines)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(transactionLines.id, lineId))
      .returning();

    if (!line) {
      throw new ServiceError('Transaction line not found', 'NOT_FOUND', 404);
    }

    return line;
  }

  /**
   * Delete a transaction line
   */
  protected async deleteLine(lineId: string): Promise<void> {
    await db
      .delete(transactionLines)
      .where(eq(transactionLines.id, lineId));
  }

  /**
   * Delete all lines for a transaction
   */
  protected async deleteLinesByTransactionId(transactionId: string): Promise<void> {
    await db
      .delete(transactionLines)
      .where(eq(transactionLines.transactionId, transactionId));
  }

  // ==========================================================================
  // LIST WITH FILTERS
  // ==========================================================================

  /**
   * List transaction headers with filters and pagination
   */
  protected async listHeaders(
    params: PaginationParams = {},
    filters: TransactionFilters = {}
  ): Promise<PaginatedResult<TransactionHeader>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(params);

    // Build where conditions
    const conditions = [
      eq(transactionHeaders.organizationId, organizationId),
      eq(transactionHeaders.transactionType, this.transactionType),
    ];

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(transactionHeaders.status, filters.status));
      } else {
        conditions.push(eq(transactionHeaders.status, filters.status));
      }
    }

    if (filters.entityId) {
      conditions.push(eq(transactionHeaders.entityId, filters.entityId));
    }

    if (filters.subsidiaryId) {
      conditions.push(eq(transactionHeaders.subsidiaryId, filters.subsidiaryId));
    }

    if (filters.dateFrom) {
      const dateFrom = typeof filters.dateFrom === 'string'
        ? filters.dateFrom
        : filters.dateFrom.toISOString().split('T')[0];
      conditions.push(gte(transactionHeaders.transactionDate, dateFrom));
    }

    if (filters.dateTo) {
      const dateTo = typeof filters.dateTo === 'string'
        ? filters.dateTo
        : filters.dateTo.toISOString().split('T')[0];
      conditions.push(lte(transactionHeaders.transactionDate, dateTo));
    }

    if (filters.search) {
      conditions.push(
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
      .where(and(...conditions));
    const total = Number(countResult[0]?.count || 0);

    // Fetch headers
    const headers = await db
      .select()
      .from(transactionHeaders)
      .where(and(...conditions))
      .orderBy(desc(transactionHeaders.createdAt))
      .limit(take)
      .offset(skip);

    return this.createPaginatedResult(headers, total, page, limit);
  }

  // ==========================================================================
  // LINE CALCULATIONS
  // ==========================================================================

  /**
   * Calculate line totals from input
   */
  protected calculateLineTotals(lines: CreateTransactionLineInput[]): LineCalculationResult {
    let subtotal = new Decimal(0);
    let taxTotal = new Decimal(0);

    const calculatedLines = lines.map((line, index) => {
      const quantity = new Decimal(line.quantity);
      const unitPrice = new Decimal(line.unitPrice);
      const amount = quantity.times(unitPrice);
      const taxAmount = new Decimal(line.taxAmount || 0);

      subtotal = subtotal.plus(amount);
      taxTotal = taxTotal.plus(taxAmount);

      return {
        ...line,
        lineNumber: line.lineNumber || index + 1,
        amount: amount.toNumber(),
      };
    });

    const totalAmount = subtotal.plus(taxTotal);

    return {
      lines: calculatedLines,
      subtotal: subtotal.toNumber(),
      taxTotal: taxTotal.toNumber(),
      totalAmount: totalAmount.toNumber(),
    };
  }

  /**
   * Recalculate header totals from lines
   */
  protected async recalculateHeaderTotals(transactionId: string): Promise<TransactionHeader> {
    const lines = await this.getLinesByTransactionId(transactionId);

    let subtotal = new Decimal(0);
    let taxTotal = new Decimal(0);

    for (const line of lines) {
      subtotal = subtotal.plus(new Decimal(line.amount));
      taxTotal = taxTotal.plus(new Decimal(line.taxAmount || 0));
    }

    const totalAmount = subtotal.plus(taxTotal);

    return this.updateHeader(transactionId, {
      subtotal: subtotal.toFixed(4),
      taxAmount: taxTotal.toFixed(4),
      totalAmount: totalAmount.toFixed(4),
    });
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Convert date to string format
   */
  protected toDateString(date: string | Date): string {
    if (typeof date === 'string') {
      return date.split('T')[0];
    }
    return date.toISOString().split('T')[0];
  }

  /**
   * Validate status transition
   */
  protected validateStatusTransition(
    currentStatus: string,
    newStatus: string,
    validTransitions: Record<string, string[]>
  ): void {
    const allowedTransitions = validTransitions[currentStatus];
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      throw new ServiceError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
        'INVALID_STATUS_TRANSITION',
        400
      );
    }
  }

  /**
   * Transform header to base interface
   */
  protected transformHeader(header: TransactionHeader): BaseTransactionHeader {
    return {
      id: header.id,
      organizationId: header.organizationId,
      subsidiaryId: header.subsidiaryId,
      transactionType: header.transactionType as TransactionTypeCodeValue,
      transactionNumber: header.transactionNumber,
      entityId: header.entityId,
      entityName: header.entityName || undefined,
      transactionDate: header.transactionDate,
      status: header.status,
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
    };
  }

  /**
   * Transform line to base interface
   */
  protected transformLine(line: TransactionLine): BaseTransactionLine {
    return {
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
    };
  }

  // ==========================================================================
  // EVENT EMISSION
  // ==========================================================================

  /**
   * Emit a transaction event
   */
  protected async emitEvent(
    eventType: string,
    transactionId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    await this.eventService.emit({
      eventType,
      eventCategory: this.eventCategory,
      aggregateType: this.transactionType,
      aggregateId: transactionId,
      data,
    });
  }
}
