import { eq, and, desc, gte, lte, or, ilike, sql } from "drizzle-orm";
import { invoices, type Invoice, type NewInvoice, type UpdateInvoice } from "../db/schema/invoices";
import { invoiceLineItems } from "../db/schema/invoice-line-items";
import { type NewInvoiceLineItem, type InvoiceLineItem } from "../db/schema/invoice-line-items";
import { payments } from "../db/schema/payments";
import { BaseRepository } from "./base-repository";

export interface InvoiceWithLineItems extends Invoice {
  lineItems?: InvoiceLineItem[];
  paidAmount?: string;
  balanceDue?: string;
}

export interface InvoiceListOptions {
  organizationId: string;
  entityId?: string;
  subscriptionId?: string;
  status?: string;
  invoiceDateFrom?: string;
  invoiceDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

export class InvoiceRepository extends BaseRepository {
  constructor() {
    super();
  }

  /**
   * Create a new invoice
   */
  async create(data: NewInvoice): Promise<Invoice> {
    const [result] = await this.db
      .insert(invoices)
      .values(data)
      .returning();
    return result;
  }

  /**
   * Find invoice by ID with line items and payment info
   */
  async findByIdWithDetails(id: string): Promise<InvoiceWithLineItems | null> {
    // Get invoice with line items
    const invoiceResults = await this.db
      .select()
      .from(invoices)
      .leftJoin(invoiceLineItems, eq(invoiceLineItems.invoiceId, invoices.id))
      .where(eq(invoices.id, id));

    if (invoiceResults.length === 0) {
      return null;
    }

    const invoice = invoiceResults[0].invoices;
    const lineItems = invoiceResults
      .filter(r => r.invoice_line_items !== null)
      .map(r => r.invoice_line_items!);

    // Get payment information
    const paymentResults = await this.db
      .select({
        totalPaid: sql<string>`COALESCE(SUM(${payments.amount}), 0)::text`
      })
      .from(payments)
      .where(
        and(
          eq(payments.invoiceId, id),
          eq(payments.status, "completed")
        )
      );

    const paidAmount = paymentResults[0]?.totalPaid || "0";
    const totalAmount = parseFloat(invoice.totalAmount);
    const paid = parseFloat(paidAmount);
    const balanceDue = (totalAmount - paid).toFixed(2);

    return {
      ...invoice,
      lineItems,
      paidAmount,
      balanceDue
    };
  }

  /**
   * Find invoice by invoice number
   */
  async findByNumber(organizationId: string, invoiceNumber: string): Promise<Invoice | null> {
    const [result] = await this.db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          eq(invoices.invoiceNumber, invoiceNumber)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * List invoices with filtering
   */
  async list(options: InvoiceListOptions): Promise<{ data: InvoiceWithLineItems[]; total: number }> {
    const conditions = [eq(invoices.organizationId, options.organizationId)];

    if (options.entityId) {
      conditions.push(eq(invoices.entityId, options.entityId));
    }

    if (options.subscriptionId) {
      conditions.push(eq(invoices.subscriptionId, options.subscriptionId));
    }

    if (options.status) {
      conditions.push(eq(invoices.status, options.status as any));
    }

    if (options.invoiceDateFrom) {
      conditions.push(gte(invoices.invoiceDate, options.invoiceDateFrom));
    }

    if (options.invoiceDateTo) {
      conditions.push(lte(invoices.invoiceDate, options.invoiceDateTo));
    }

    if (options.dueDateFrom) {
      conditions.push(gte(invoices.dueDate, options.dueDateFrom));
    }

    if (options.dueDateTo) {
      conditions.push(lte(invoices.dueDate, options.dueDateTo));
    }

    if (options.search) {
      conditions.push(
        ilike(invoices.invoiceNumber, `%${options.search}%`)
      );
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(invoices)
      .where(whereClause);

    // Get paginated results with payment info
    const invoiceList = await this.db
      .select({
        invoice: invoices,
        paidAmount: sql<string>`
          COALESCE(
            (SELECT SUM(p.amount) 
             FROM ${payments} p 
             WHERE p.invoice_id = ${invoices.id} 
               AND p.status = 'completed'
            ), 0
          )::text
        `
      })
      .from(invoices)
      .where(whereClause)
      .orderBy(desc(invoices.invoiceDate))
      .limit(options.limit || 50)
      .offset(options.offset || 0);

    const data = invoiceList.map(row => {
      const totalAmount = parseFloat(row.invoice.totalAmount);
      const paid = parseFloat(row.paidAmount);
      const balanceDue = (totalAmount - paid).toFixed(2);

      return {
        ...row.invoice,
        paidAmount: row.paidAmount,
        balanceDue
      };
    });

    return {
      data,
      total: Number(count)
    };
  }

  /**
   * Create invoice with line items
   */
  async createWithLineItems(
    invoice: NewInvoice,
    lineItems: Omit<NewInvoiceLineItem, "invoiceId">[]
  ): Promise<InvoiceWithLineItems> {
    return await this.db.transaction(async (tx) => {
      // Create invoice
      const [newInvoice] = await tx
        .insert(invoices)
        .values(invoice)
        .returning();

      // Create line items if provided
      let createdLineItems: InvoiceLineItem[] = [];
      if (lineItems && lineItems.length > 0) {
        const itemsToCreate = lineItems.map(item => ({
          ...item,
          invoiceId: newInvoice.id
        }));

        createdLineItems = await tx
          .insert(invoiceLineItems)
          .values(itemsToCreate)
          .returning();
      }

      return {
        ...newInvoice,
        lineItems: createdLineItems,
        paidAmount: "0",
        balanceDue: newInvoice.totalAmount
      };
    });
  }

  /**
   * Update invoice
   */
  async update(id: string, data: UpdateInvoice): Promise<Invoice | null> {
    const [updated] = await this.db
      .update(invoices)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(invoices.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Add line item to invoice
   */
  async addLineItem(lineItem: NewInvoiceLineItem): Promise<InvoiceLineItem> {
    const [newLineItem] = await this.db
      .insert(invoiceLineItems)
      .values(lineItem)
      .returning();

    // Update invoice totals
    await this.recalculateInvoiceTotals(lineItem.invoiceId);

    return newLineItem;
  }

  /**
   * Remove line item from invoice
   */
  async removeLineItem(lineItemId: string): Promise<void> {
    const [lineItem] = await this.db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.id, lineItemId))
      .limit(1);

    if (lineItem) {
      await this.db
        .delete(invoiceLineItems)
        .where(eq(invoiceLineItems.id, lineItemId));

      // Update invoice totals
      await this.recalculateInvoiceTotals(lineItem.invoiceId);
    }
  }

  /**
   * Recalculate invoice totals from line items
   */
  async recalculateInvoiceTotals(invoiceId: string): Promise<void> {
    const lineItems = await this.db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId));

    const subtotal = lineItems.reduce((total, item) => {
      return total + parseFloat(item.amount);
    }, 0);

    const [invoice] = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (invoice) {
      const taxAmount = parseFloat(invoice.taxAmount || "0");
      const totalAmount = subtotal + taxAmount;

      await this.db
        .update(invoices)
        .set({
          subtotal: subtotal.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(invoices.id, invoiceId));
    }
  }

  /**
   * Update invoice status based on payment
   */
  async updateInvoiceStatus(invoiceId: string): Promise<void> {
    const invoice = await this.findByIdWithDetails(invoiceId);
    if (!invoice) return;

    const totalAmount = parseFloat(invoice.totalAmount);
    const paidAmount = parseFloat(invoice.paidAmount || "0");

    let newStatus: string;
    if (paidAmount >= totalAmount) {
      newStatus = "paid";
    } else if (paidAmount > 0) {
      newStatus = "partial";
    } else if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) {
      newStatus = "overdue";
    } else {
      newStatus = invoice.status;
    }

    if (newStatus !== invoice.status) {
      await this.db
        .update(invoices)
        .set({
          status: newStatus as any,
          updatedAt: new Date()
        })
        .where(eq(invoices.id, invoiceId));
    }
  }

  /**
   * Get invoices for subscription
   */
  async getBySubscription(organizationId: string, subscriptionId: string): Promise<Invoice[]> {
    return await this.db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          eq(invoices.subscriptionId, subscriptionId)
        )
      )
      .orderBy(desc(invoices.invoiceDate));
  }

  /**
   * Get overdue invoices
   */
  async getOverdueInvoices(organizationId: string): Promise<InvoiceWithLineItems[]> {
    const overdueInvoices = await this.db
      .select({
        invoice: invoices,
        paidAmount: sql<string>`
          COALESCE(
            (SELECT SUM(p.amount) 
             FROM ${payments} p 
             WHERE p.invoice_id = ${invoices.id} 
               AND p.status = 'completed'
            ), 0
          )::text
        `
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          lte(invoices.dueDate, new Date().toISOString().split('T')[0]),
          or(
            eq(invoices.status, "sent"),
            eq(invoices.status, "partial"),
            eq(invoices.status, "overdue")
          )
        )
      );

    return overdueInvoices
      .filter(row => {
        const totalAmount = parseFloat(row.invoice.totalAmount);
        const paid = parseFloat(row.paidAmount);
        return paid < totalAmount;
      })
      .map(row => {
        const totalAmount = parseFloat(row.invoice.totalAmount);
        const paid = parseFloat(row.paidAmount);
        const balanceDue = (totalAmount - paid).toFixed(2);

        return {
          ...row.invoice,
          paidAmount: row.paidAmount,
          balanceDue
        };
      });
  }

  /**
   * Generate next invoice number
   */
  async generateInvoiceNumber(organizationId: string, prefix: string = "INV"): Promise<string> {
    const [lastInvoice] = await this.db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          ilike(invoices.invoiceNumber, `${prefix}-%`)
        )
      )
      .orderBy(desc(invoices.createdAt))
      .limit(1);

    if (!lastInvoice) {
      return `${prefix}-00001`;
    }

    const match = lastInvoice.invoiceNumber.match(/(\d+)$/);
    const nextNumber = match ? parseInt(match[1]) + 1 : 1;
    
    return `${prefix}-${nextNumber.toString().padStart(5, '0')}`;
  }
}