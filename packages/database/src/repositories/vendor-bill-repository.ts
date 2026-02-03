/**
 * Vendor Bill Repository
 *
 * Data access layer for vendor bills, handling all database operations
 * for the vendor_bills table.
 */

import { and, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  vendorBills,
  vendorBillApprovalHistory,
  billPaymentApplications,
  purchaseOrders,
  entities,
  type VendorBillStatusValue,
  type ThreeWayMatchStatusValue,
  type BillApprovalActionTypeValue,
} from '../db/schema';

// ============================================================================
// Types
// ============================================================================

export interface VendorBillFilters {
  status?: VendorBillStatusValue | VendorBillStatusValue[];
  vendorId?: string;
  subsidiaryId?: string;
  purchaseOrderId?: string;
  threeWayMatchStatus?: ThreeWayMatchStatusValue;
  billDateFrom?: string | Date;
  billDateTo?: string | Date;
  hasBalance?: boolean;
  search?: string;
}

export interface VendorBillPaginationParams {
  skip: number;
  take: number;
}

export interface CreateVendorBillData {
  organizationId: string;
  subsidiaryId?: string;
  billNumber: string;
  vendorInvoiceNumber?: string;
  vendorId: string;
  vendorName?: string;
  purchaseOrderId?: string;
  billDate: string;
  dueDate: string;
  receivedDate?: string | null;
  status: VendorBillStatusValue;
  threeWayMatchStatus: ThreeWayMatchStatusValue;
  subtotal: string;
  taxAmount: string;
  shippingAmount: string;
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
  discountDate?: string | null;
  discountPercent?: string;
  discountAmount?: string;
  discountTaken: string;
  apAccountId?: string;
  paymentTerms?: string;
  currencyCode: string;
  exchangeRate: string;
  memo?: string;
  internalNotes?: string;
  createdBy: string;
  updatedBy: string;
}

export interface UpdateVendorBillData {
  status?: VendorBillStatusValue;
  threeWayMatchStatus?: ThreeWayMatchStatusValue;
  matchVarianceAmount?: string;
  matchOverrideReason?: string;
  matchOverrideBy?: string;
  matchOverrideAt?: Date;
  paidAmount?: string;
  discountTaken?: string;
  balanceDue?: string;
  approvedAt?: Date;
  approvedBy?: string;
  voidedAt?: Date;
  voidedBy?: string;
  voidReason?: string;
  updatedBy?: string;
  updatedAt?: Date;
}

export interface ApprovalHistoryEntry {
  vendorBillId: string;
  action: BillApprovalActionTypeValue;
  fromStatus?: VendorBillStatusValue;
  toStatus: VendorBillStatusValue;
  performedBy: string;
  comments?: string;
}

// ============================================================================
// Repository
// ============================================================================

export class VendorBillRepository extends BaseRepository {
  /**
   * Find a vendor bill by ID with organization context
   */
  async findById(id: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(vendorBills)
      .where(and(eq(vendorBills.id, id), eq(vendorBills.organizationId, organizationId)))
      .limit(1);

    return result || null;
  }

  /**
   * Find vendor bills with filters and pagination
   */
  async findAll(
    organizationId: string,
    pagination: VendorBillPaginationParams,
    filters: VendorBillFilters = {}
  ) {
    const conditions = this.buildFilterConditions(organizationId, filters);

    // Count total
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(vendorBills)
      .where(and(...conditions));
    const total = Number(countResult[0]?.count || 0);

    // Fetch bills
    const results = await this.db
      .select()
      .from(vendorBills)
      .where(and(...conditions))
      .orderBy(desc(vendorBills.createdAt))
      .limit(pagination.take)
      .offset(pagination.skip);

    return { results, total };
  }

  /**
   * Find bills by purchase order ID
   */
  async findByPurchaseOrderId(purchaseOrderId: string, organizationId: string) {
    return this.db
      .select()
      .from(vendorBills)
      .where(
        and(
          eq(vendorBills.purchaseOrderId, purchaseOrderId),
          eq(vendorBills.organizationId, organizationId)
        )
      );
  }

  /**
   * Find bills by vendor ID with optional status filter
   */
  async findByVendorId(vendorId: string, organizationId: string, statuses?: VendorBillStatusValue[]) {
    const conditions = [
      eq(vendorBills.organizationId, organizationId),
      eq(vendorBills.vendorId, vendorId),
    ];

    if (statuses && statuses.length > 0) {
      conditions.push(inArray(vendorBills.status, statuses));
    }

    return this.db.select().from(vendorBills).where(and(...conditions));
  }

  /**
   * Create a new vendor bill
   */
  async create(data: CreateVendorBillData) {
    const [result] = await this.db
      .insert(vendorBills)
      .values({
        organizationId: data.organizationId,
        subsidiaryId: data.subsidiaryId,
        billNumber: data.billNumber,
        vendorInvoiceNumber: data.vendorInvoiceNumber,
        vendorId: data.vendorId,
        vendorName: data.vendorName,
        purchaseOrderId: data.purchaseOrderId,
        billDate: data.billDate,
        dueDate: data.dueDate,
        receivedDate: data.receivedDate,
        status: data.status,
        threeWayMatchStatus: data.threeWayMatchStatus,
        subtotal: data.subtotal,
        taxAmount: data.taxAmount,
        shippingAmount: data.shippingAmount,
        totalAmount: data.totalAmount,
        paidAmount: data.paidAmount,
        balanceDue: data.balanceDue,
        discountDate: data.discountDate,
        discountPercent: data.discountPercent,
        discountAmount: data.discountAmount,
        discountTaken: data.discountTaken,
        apAccountId: data.apAccountId,
        paymentTerms: data.paymentTerms,
        currencyCode: data.currencyCode,
        exchangeRate: data.exchangeRate,
        memo: data.memo,
        internalNotes: data.internalNotes,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
      })
      .returning();

    return result;
  }

  /**
   * Update a vendor bill
   */
  async update(id: string, organizationId: string, data: UpdateVendorBillData) {
    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: data.updatedAt || new Date(),
    };

    const [result] = await this.db
      .update(vendorBills)
      .set(updateData)
      .where(and(eq(vendorBills.id, id), eq(vendorBills.organizationId, organizationId)))
      .returning();

    return result || null;
  }

  /**
   * Update bill status
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: VendorBillStatusValue,
    userId: string,
    additionalFields?: Record<string, unknown>
  ) {
    const updateData: Record<string, unknown> = {
      status,
      updatedBy: userId,
      updatedAt: new Date(),
      ...additionalFields,
    };

    const [result] = await this.db
      .update(vendorBills)
      .set(updateData)
      .where(and(eq(vendorBills.id, id), eq(vendorBills.organizationId, organizationId)))
      .returning();

    return result || null;
  }

  /**
   * Update 3-way match status
   */
  async updateMatchStatus(
    id: string,
    matchStatus: ThreeWayMatchStatusValue,
    varianceAmount?: string
  ) {
    await this.db
      .update(vendorBills)
      .set({
        threeWayMatchStatus: matchStatus,
        matchVarianceAmount: varianceAmount,
        updatedAt: new Date(),
      })
      .where(eq(vendorBills.id, id));
  }

  /**
   * Update payment amounts
   */
  async updatePaymentAmounts(
    id: string,
    paidAmount: string,
    discountTaken: string,
    balanceDue: string,
    status: VendorBillStatusValue
  ) {
    await this.db
      .update(vendorBills)
      .set({
        paidAmount,
        discountTaken,
        balanceDue,
        status,
        updatedAt: new Date(),
      })
      .where(eq(vendorBills.id, id));
  }

  /**
   * Record approval history
   */
  async recordApprovalHistory(entry: ApprovalHistoryEntry) {
    await this.db.insert(vendorBillApprovalHistory).values({
      vendorBillId: entry.vendorBillId,
      action: entry.action,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      performedBy: entry.performedBy,
      comments: entry.comments,
    });
  }

  /**
   * Get approval history for a bill
   */
  async getApprovalHistory(vendorBillId: string) {
    return this.db
      .select()
      .from(vendorBillApprovalHistory)
      .where(eq(vendorBillApprovalHistory.vendorBillId, vendorBillId))
      .orderBy(desc(vendorBillApprovalHistory.performedAt));
  }

  /**
   * Get payment applications for a bill
   */
  async getPaymentApplications(vendorBillId: string) {
    return this.db
      .select()
      .from(billPaymentApplications)
      .where(
        and(
          eq(billPaymentApplications.vendorBillId, vendorBillId),
          isNull(billPaymentApplications.reversedAt)
        )
      );
  }

  /**
   * Get vendor info
   */
  async getVendor(vendorId: string) {
    const [result] = await this.db
      .select({ id: entities.id, name: entities.name })
      .from(entities)
      .where(eq(entities.id, vendorId))
      .limit(1);

    return result || null;
  }

  /**
   * Get purchase order info
   */
  async getPurchaseOrder(purchaseOrderId: string) {
    const [result] = await this.db
      .select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, purchaseOrderId))
      .limit(1);

    return result || null;
  }

  /**
   * Get PO with full details
   */
  async getPurchaseOrderFull(purchaseOrderId: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.id, purchaseOrderId),
          eq(purchaseOrders.organizationId, organizationId)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * Generate next bill number
   */
  async generateBillNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await this.db.execute(sql`
      SELECT COUNT(*) + 1 as seq
      FROM vendor_bills
      WHERE bill_number LIKE ${`BILL-${year}-%`}
    `);
    const seq = String((result.rows[0] as { seq: number }).seq).padStart(6, '0');
    return `BILL-${year}-${seq}`;
  }

  /**
   * Get vendor account summary (for reporting)
   */
  async getVendorAccountSummary(vendorId: string, organizationId: string, statuses: VendorBillStatusValue[]) {
    const billStats = await this.db
      .select({
        totalOutstanding: sql<string>`sum(balance_due::decimal)`,
        totalOverdue: sql<string>`sum(case when due_date < current_date and balance_due::decimal > 0 then balance_due::decimal else 0 end)`,
        oldestBillDate: sql<string>`min(bill_date)`,
        billCount: sql<number>`count(*)`,
        overdueBillCount: sql<number>`count(case when due_date < current_date and balance_due::decimal > 0 then 1 end)`,
      })
      .from(vendorBills)
      .where(
        and(
          eq(vendorBills.organizationId, organizationId),
          eq(vendorBills.vendorId, vendorId),
          inArray(vendorBills.status, statuses)
        )
      );

    return billStats[0];
  }

  /**
   * Get AP aging summary (for reporting)
   */
  async getAPAgingSummary(organizationId: string, statuses: VendorBillStatusValue[], subsidiaryId?: string) {
    const conditions = [
      eq(vendorBills.organizationId, organizationId),
      inArray(vendorBills.status, statuses),
      sql`${vendorBills.balanceDue}::decimal > 0`,
    ];

    if (subsidiaryId) {
      conditions.push(eq(vendorBills.subsidiaryId, subsidiaryId));
    }

    const agingResult = await this.db
      .select({
        current: sql<string>`sum(case when due_date >= current_date then balance_due::decimal else 0 end)`,
        days1to30: sql<string>`sum(case when due_date < current_date and due_date >= current_date - interval '30 days' then balance_due::decimal else 0 end)`,
        days31to60: sql<string>`sum(case when due_date < current_date - interval '30 days' and due_date >= current_date - interval '60 days' then balance_due::decimal else 0 end)`,
        days61to90: sql<string>`sum(case when due_date < current_date - interval '60 days' and due_date >= current_date - interval '90 days' then balance_due::decimal else 0 end)`,
        over90: sql<string>`sum(case when due_date < current_date - interval '90 days' then balance_due::decimal else 0 end)`,
        total: sql<string>`sum(balance_due::decimal)`,
      })
      .from(vendorBills)
      .where(and(...conditions));

    return agingResult[0];
  }

  /**
   * Update PO billed amount
   */
  async updatePOBilledAmount(purchaseOrderId: string, amountToAdd: string) {
    await this.db.execute(sql`
      UPDATE purchase_orders
      SET billed_amount = billed_amount + ${amountToAdd}::decimal,
          status = CASE
            WHEN billed_amount + ${amountToAdd}::decimal >= total_amount::decimal THEN 'BILLED'
            ELSE status
          END,
          updated_at = NOW()
      WHERE id = ${purchaseOrderId}
    `);
  }

  /**
   * Reverse PO billed amount
   */
  async reversePOBilledAmount(purchaseOrderId: string, amountToSubtract: string) {
    await this.db.execute(sql`
      UPDATE purchase_orders
      SET billed_amount = GREATEST(0, billed_amount - ${amountToSubtract}::decimal),
          status = CASE
            WHEN status = 'BILLED' THEN 'RECEIVED'
            ELSE status
          END,
          updated_at = NOW()
      WHERE id = ${purchaseOrderId}
    `);
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private buildFilterConditions(organizationId: string, filters: VendorBillFilters) {
    const conditions: ReturnType<typeof eq>[] = [eq(vendorBills.organizationId, organizationId)];

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(vendorBills.status, filters.status));
      } else {
        conditions.push(eq(vendorBills.status, filters.status));
      }
    }

    if (filters.vendorId) {
      conditions.push(eq(vendorBills.vendorId, filters.vendorId));
    }

    if (filters.subsidiaryId) {
      conditions.push(eq(vendorBills.subsidiaryId, filters.subsidiaryId));
    }

    if (filters.purchaseOrderId) {
      conditions.push(eq(vendorBills.purchaseOrderId, filters.purchaseOrderId));
    }

    if (filters.threeWayMatchStatus) {
      conditions.push(eq(vendorBills.threeWayMatchStatus, filters.threeWayMatchStatus));
    }

    if (filters.billDateFrom) {
      const dateFrom =
        typeof filters.billDateFrom === 'string'
          ? filters.billDateFrom
          : filters.billDateFrom.toISOString().split('T')[0];
      conditions.push(gte(vendorBills.billDate, dateFrom));
    }

    if (filters.billDateTo) {
      const dateTo =
        typeof filters.billDateTo === 'string'
          ? filters.billDateTo
          : filters.billDateTo.toISOString().split('T')[0];
      conditions.push(lte(vendorBills.billDate, dateTo));
    }

    if (filters.hasBalance) {
      conditions.push(sql`${vendorBills.balanceDue}::decimal > 0`);
    }

    if (filters.search) {
      conditions.push(
        or(
          ilike(vendorBills.billNumber, `%${filters.search}%`),
          ilike(vendorBills.vendorInvoiceNumber, `%${filters.search}%`),
          ilike(vendorBills.vendorName, `%${filters.search}%`),
          ilike(vendorBills.memo, `%${filters.search}%`)
        )!
      );
    }

    return conditions;
  }
}
