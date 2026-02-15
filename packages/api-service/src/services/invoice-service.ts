import { BaseService } from './base-service';
import { ServiceContext, ServiceError, PaginatedResult } from '../types';
import {
  InvoiceRepository,
  SubscriptionRepository,
  SubscriptionItemRepository,
  ProjectTaskRepository,
  type Invoice,
  type NewInvoice,
  type UpdateInvoice,
  type ContextualDatabase
} from '@glapi/database';

export interface InvoiceServiceOptions {
  db?: ContextualDatabase;
}

export interface CreateInvoiceData {
  organizationId?: string;
  entityId: string;
  subscriptionId?: string;
  invoiceNumber?: string;
  invoiceDate: Date | string;
  dueDate?: Date | string;
  billingPeriodStart?: Date | string;
  billingPeriodEnd?: Date | string;
  subtotal?: string | number;
  taxAmount?: string | number;
  totalAmount?: string | number;
  paidAmount?: string | number;
  balanceDue?: string | number;
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  metadata?: any;
  lineItems?: Array<{
    subscriptionItemId?: string;
    itemId?: string;
    description: string;
    quantity: string | number;
    unitPrice: string | number;
    amount: string | number;
  }>;
}

export interface UpdateInvoiceData extends Partial<UpdateInvoice> {
  lineItems?: Array<{
    id?: string;
    subscriptionItemId?: string;
    itemId?: string;
    description: string;
    quantity: string | number;
    unitPrice: string | number;
    amount: string | number;
  }>;
}

export interface ListInvoicesInput {
  entityId?: string;
  subscriptionId?: string;
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  dateFrom?: Date | string;
  dateTo?: Date | string;
  page?: number;
  limit?: number;
}

export interface GenerateInvoiceParams {
  subscriptionId: string;
  billingPeriodStart: Date | string;
  billingPeriodEnd: Date | string;
  invoiceDate?: Date | string;
}

/**
 * Invoice with line items - explicitly includes base Invoice properties
 * for TypeScript inference
 */
export interface InvoiceWithLineItems {
  // Base Invoice properties
  id: string;
  organizationId: string;
  invoiceNumber: string;
  entityId: string;
  subscriptionId?: string | null;
  salesOrderId?: string | null;
  invoiceDate: string;
  dueDate?: string | null;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
  subtotal: string;
  taxAmount?: string | null;
  totalAmount: string;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled' | 'void';
  metadata?: unknown;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  // Extended properties
  lineItems?: Array<{
    id: string;
    invoiceId: string;
    subscriptionItemId?: string;
    itemId?: string;
    description: string;
    quantity: string;
    unitPrice: string;
    amount: string;
  }>;
}

export class InvoiceService extends BaseService {
  private invoiceRepository: InvoiceRepository;
  private subscriptionRepository: SubscriptionRepository;
  private subscriptionItemRepository: SubscriptionItemRepository;
  private projectTaskRepository: ProjectTaskRepository;

  constructor(context: ServiceContext = {}, options: InvoiceServiceOptions = {}) {
    super(context);
    // Pass the contextual db to the repositories for RLS support
    this.invoiceRepository = new InvoiceRepository(options.db);
    this.subscriptionRepository = new SubscriptionRepository(options.db);
    this.subscriptionItemRepository = new SubscriptionItemRepository(options.db);
    this.projectTaskRepository = new ProjectTaskRepository(options.db);
  }

  async listInvoices(input: ListInvoicesInput = {}): Promise<PaginatedResult<Invoice>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(input);

    const result = await this.invoiceRepository.list({
      organizationId,
      entityId: input.entityId,
      subscriptionId: input.subscriptionId,
      status: input.status,
      invoiceDateFrom: input.dateFrom ? (typeof input.dateFrom === 'string' ? input.dateFrom : input.dateFrom.toISOString().split('T')[0]) : undefined,
      invoiceDateTo: input.dateTo ? (typeof input.dateTo === 'string' ? input.dateTo : input.dateTo.toISOString().split('T')[0]) : undefined,
      limit: take,
      offset: skip
    });

    return this.createPaginatedResult(result.data, result.total, page, limit);
  }

  /**
   * Transform repository invoice to service format (null -> undefined)
   */
  private transformInvoice(invoice: any): InvoiceWithLineItems {
    return {
      ...invoice,
      lineItems: invoice.lineItems?.map((item: any) => ({
        id: item.id,
        invoiceId: item.invoiceId,
        subscriptionItemId: item.subscriptionItemId ?? undefined,
        itemId: item.itemId ?? undefined,
        description: item.description ?? '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      })),
    };
  }

  async getInvoiceById(id: string): Promise<InvoiceWithLineItems | null> {
    const organizationId = this.requireOrganizationContext();

    const invoice = await this.invoiceRepository.findByIdWithDetails(id);
    if (!invoice || invoice.organizationId !== organizationId) {
      return null;
    }

    return this.transformInvoice(invoice);
  }

  async createInvoice(data: CreateInvoiceData): Promise<InvoiceWithLineItems> {
    const organizationId = this.requireOrganizationContext();
    
    // Generate invoice number if not provided
    const invoiceNumber = data.invoiceNumber || await this.generateInvoiceNumber();
    
    const { lineItems, ...invoiceData } = data;
    
    // Convert data types
    const invoiceToCreate = {
      ...invoiceData,
      invoiceNumber,
      organizationId,
      status: data.status || 'draft',
      invoiceDate: typeof data.invoiceDate === 'string' ? data.invoiceDate : data.invoiceDate.toISOString().split('T')[0],
      dueDate: data.dueDate ? (typeof data.dueDate === 'string' ? data.dueDate : data.dueDate.toISOString().split('T')[0]) : undefined,
      billingPeriodStart: data.billingPeriodStart ? (typeof data.billingPeriodStart === 'string' ? data.billingPeriodStart : data.billingPeriodStart.toISOString().split('T')[0]) : undefined,
      billingPeriodEnd: data.billingPeriodEnd ? (typeof data.billingPeriodEnd === 'string' ? data.billingPeriodEnd : data.billingPeriodEnd.toISOString().split('T')[0]) : undefined,
      subtotal: data.subtotal ? String(data.subtotal) : '0',
      taxAmount: data.taxAmount ? String(data.taxAmount) : '0',
      totalAmount: data.totalAmount ? String(data.totalAmount) : '0',
      paidAmount: data.paidAmount ? String(data.paidAmount) : '0',
      balanceDue: data.balanceDue ? String(data.balanceDue) : '0'
    } as NewInvoice;

    // Convert line items
    const itemsToCreate = lineItems?.map(item => ({
      subscriptionItemId: item.subscriptionItemId,
      itemId: item.itemId,
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      amount: String(item.amount)
    })) || [];

    const created = await this.invoiceRepository.createWithLineItems(invoiceToCreate, itemsToCreate);
    return this.transformInvoice(created);
  }

  async generateFromSubscription(params: GenerateInvoiceParams): Promise<InvoiceWithLineItems> {
    const organizationId = this.requireOrganizationContext();
    
    // Get subscription with items
    const subscription = await this.subscriptionRepository.findByIdWithItems(params.subscriptionId);
    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }

    if (!subscription.items || subscription.items.length === 0) {
      throw new ServiceError('Subscription has no items to invoice', 'NO_ITEMS', 400);
    }

    // Calculate invoice details
    const invoiceDate = params.invoiceDate 
      ? (typeof params.invoiceDate === 'string' ? params.invoiceDate : params.invoiceDate.toISOString().split('T')[0])
      : new Date().toISOString().split('T')[0];
    
    const billingPeriodStart = typeof params.billingPeriodStart === 'string' 
      ? params.billingPeriodStart 
      : params.billingPeriodStart.toISOString().split('T')[0];
    
    const billingPeriodEnd = typeof params.billingPeriodEnd === 'string'
      ? params.billingPeriodEnd
      : params.billingPeriodEnd.toISOString().split('T')[0];

    // Calculate line items from subscription items
    const lineItems = subscription.items.map(item => {
      const quantity = parseFloat(item.quantity);
      const unitPrice = parseFloat(item.unitPrice);
      const discountPercentage = item.discountPercentage ? parseFloat(item.discountPercentage) : 0;
      
      const amount = quantity * unitPrice * (1 - discountPercentage / 100);
      
      return {
        subscriptionItemId: item.id,
        itemId: item.itemId,
        description: `Subscription item for period ${billingPeriodStart} to ${billingPeriodEnd}`,
        quantity: String(quantity),
        unitPrice: String(unitPrice),
        amount: String(amount.toFixed(2))
      };
    });

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
    const taxAmount = 0; // TODO: Implement tax calculation
    const totalAmount = subtotal + taxAmount;

    // Create invoice
    const invoiceData: CreateInvoiceData = {
      entityId: subscription.entityId,
      subscriptionId: params.subscriptionId,
      invoiceDate,
      dueDate: new Date(Date.parse(invoiceDate) + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from invoice date
      billingPeriodStart,
      billingPeriodEnd,
      subtotal: String(subtotal.toFixed(2)),
      taxAmount: String(taxAmount.toFixed(2)),
      totalAmount: String(totalAmount.toFixed(2)),
      paidAmount: '0',
      balanceDue: String(totalAmount.toFixed(2)),
      status: 'draft',
      lineItems
    };

    return await this.createInvoice(invoiceData);
  }

  async updateInvoice(id: string, data: UpdateInvoiceData): Promise<InvoiceWithLineItems | null> {
    const organizationId = this.requireOrganizationContext();
    
    const existingInvoice = await this.invoiceRepository.findByIdWithDetails(id);
    if (!existingInvoice || existingInvoice.organizationId !== organizationId) {
      return null;
    }

    if (existingInvoice.status !== 'draft') {
      throw new ServiceError('Can only update draft invoices', 'INVALID_STATUS', 400);
    }

    // Update invoice (line items update not implemented in this version)
    const { lineItems, ...invoiceData } = data;
    const updatedInvoice = await this.invoiceRepository.update(id, invoiceData);
    
    if (!updatedInvoice) {
      return null;
    }

    return {
      ...updatedInvoice,
      lineItems: existingInvoice.lineItems
    } as InvoiceWithLineItems;
  }

  async sendInvoice(id: string): Promise<InvoiceWithLineItems> {
    const organizationId = this.requireOrganizationContext();
    
    const invoice = await this.invoiceRepository.findByIdWithDetails(id);
    if (!invoice || invoice.organizationId !== organizationId) {
      throw new ServiceError('Invoice not found', 'NOT_FOUND', 404);
    }

    if (invoice.status !== 'draft') {
      throw new ServiceError('Can only send draft invoices', 'INVALID_STATUS', 400);
    }

    // Update status to sent
    const updatedInvoice = await this.invoiceRepository.update(id, {
      status: 'sent',
      metadata: {
        ...(invoice.metadata as any || {}),
        sentDate: new Date().toISOString()
      }
    });

    if (!updatedInvoice) {
      throw new ServiceError('Failed to send invoice', 'UPDATE_FAILED', 500);
    }

    return {
      ...updatedInvoice,
      lineItems: invoice.lineItems
    } as InvoiceWithLineItems;
  }

  async voidInvoice(id: string, reason: string): Promise<InvoiceWithLineItems> {
    const organizationId = this.requireOrganizationContext();
    
    const invoice = await this.invoiceRepository.findByIdWithDetails(id);
    if (!invoice || invoice.organizationId !== organizationId) {
      throw new ServiceError('Invoice not found', 'NOT_FOUND', 404);
    }

    if (invoice.status === 'void') {
      throw new ServiceError('Invoice is already void', 'ALREADY_VOID', 400);
    }

    if (invoice.status === 'paid') {
      throw new ServiceError('Cannot void paid invoices', 'CANNOT_VOID_PAID', 400);
    }

    // Update status to void
    const updatedInvoice = await this.invoiceRepository.update(id, {
      status: 'void',
      metadata: {
        ...(invoice.metadata as any || {}),
        voidReason: reason,
        voidDate: new Date().toISOString()
      }
    });

    if (!updatedInvoice) {
      throw new ServiceError('Failed to void invoice', 'UPDATE_FAILED', 500);
    }

    return {
      ...updatedInvoice,
      lineItems: invoice.lineItems
    } as InvoiceWithLineItems;
  }

  async getAgingReport(asOfDate: Date): Promise<any> {
    const organizationId = this.requireOrganizationContext();
    
    // TODO: Implement aging report logic
    // This would calculate invoice aging buckets (current, 30 days, 60 days, 90+ days)
    
    return {
      asOfDate: asOfDate.toISOString().split('T')[0],
      current: 0,
      thirtyDays: 0,
      sixtyDays: 0,
      ninetyPlusDays: 0,
      total: 0,
      message: 'Aging report will be implemented in reporting phase'
    };
  }

  /**
   * Create an invoice from billable completed tasks
   */
  async createInvoiceFromBillableTasks(params: {
    projectId: string;
    entityId: string;
    taskIds: string[];
    invoiceDate?: Date | string;
    dueDate?: Date | string;
  }): Promise<InvoiceWithLineItems> {
    const organizationId = this.requireOrganizationContext();
    const { projectId, entityId, taskIds, invoiceDate, dueDate } = params;

    if (taskIds.length === 0) {
      throw new ServiceError('No tasks specified for invoicing', 'NO_TASKS', 400);
    }

    // Get all specified tasks and verify they are billable and completed
    const tasks: any[] = [];
    for (const taskId of taskIds) {
      const task = await this.projectTaskRepository.findTaskById(taskId, organizationId);
      if (!task) {
        throw new ServiceError(`Task ${taskId} not found`, 'TASK_NOT_FOUND', 404);
      }
      if (task.status !== 'COMPLETED') {
        throw new ServiceError(`Task ${task.taskName} is not completed`, 'TASK_NOT_COMPLETED', 400);
      }
      if (!task.isBillable) {
        throw new ServiceError(`Task ${task.taskName} is not billable`, 'TASK_NOT_BILLABLE', 400);
      }
      if (task.invoicedAt) {
        throw new ServiceError(`Task ${task.taskName} has already been invoiced`, 'TASK_ALREADY_INVOICED', 400);
      }
      if (task.projectId !== projectId) {
        throw new ServiceError(`Task ${task.taskName} does not belong to the specified project`, 'TASK_PROJECT_MISMATCH', 400);
      }
      tasks.push(task);
    }

    // Create line items from tasks
    const lineItems = tasks.map(task => {
      let amount: number;
      let description: string;

      if (task.billingType === 'flat_fee') {
        // Flat fee: use the flat fee amount
        amount = task.flatFeeAmount ? Number(task.flatFeeAmount) : 0;
        description = `${task.taskName} (Flat Fee)`;
      } else {
        // Time and materials: use actual hours × billing rate
        const hours = task.actualHours ? Number(task.actualHours) : 0;
        const rate = task.billingRate ? Number(task.billingRate) : 0;
        amount = hours * rate;
        description = `${task.taskName} (${hours} hrs @ $${rate}/hr)`;
      }

      return {
        itemId: task.serviceItemId,
        description,
        quantity: '1',
        unitPrice: String(amount.toFixed(2)),
        amount: String(amount.toFixed(2)),
        linkedProjectTaskId: task.id,
      };
    });

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
    const taxAmount = 0; // TODO: Implement tax calculation
    const totalAmount = subtotal + taxAmount;

    const invoiceDateStr = invoiceDate
      ? (typeof invoiceDate === 'string' ? invoiceDate : invoiceDate.toISOString().split('T')[0])
      : new Date().toISOString().split('T')[0];

    const dueDateStr = dueDate
      ? (typeof dueDate === 'string' ? dueDate : dueDate.toISOString().split('T')[0])
      : new Date(Date.parse(invoiceDateStr) + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days

    // Create the invoice
    const invoiceData: CreateInvoiceData = {
      entityId,
      invoiceDate: invoiceDateStr,
      dueDate: dueDateStr,
      subtotal: String(subtotal.toFixed(2)),
      taxAmount: String(taxAmount.toFixed(2)),
      totalAmount: String(totalAmount.toFixed(2)),
      paidAmount: '0',
      balanceDue: String(totalAmount.toFixed(2)),
      status: 'draft',
      metadata: {
        projectId,
        taskIds,
        generatedFromTasks: true,
      },
      lineItems: lineItems.map(item => ({
        itemId: item.itemId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      })),
    };

    const invoice = await this.createInvoice(invoiceData);

    // Mark tasks as invoiced
    // Note: In a production system, this should be done in a transaction
    // For now, we'll update each task individually
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const lineItem = invoice.lineItems?.[i];
      if (lineItem) {
        await this.projectTaskRepository.updateTask(task.id, organizationId, {
          invoicedAt: new Date(),
          invoiceLineId: lineItem.id,
        });
      }
    }

    return invoice;
  }

  private async generateInvoiceNumber(): Promise<string> {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `INV-${timestamp}-${random}`;
  }
}