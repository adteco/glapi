import { BaseService } from './base-service';
import {
  BusinessTransaction,
  BusinessTransactionLine,
  BusinessTransactionWithLines,
  CreateBusinessTransactionInput,
  UpdateBusinessTransactionInput,
  CreateBusinessTransactionLineInput,
  UpdateBusinessTransactionLineInput,
  CreateGlTransactionLineInput,
  PostTransactionRequest,
  ReverseTransactionRequest,
  ApproveTransactionRequest,
  PaginationParams,
  PaginatedResult,
  ServiceError
} from '../types';
import { SubsidiaryService } from './subsidiary-service';
import { EventService, TransactionEvents, EventCategory } from './event-service';
import { glTransactionRepository } from '@glapi/database';
import type {
  BusinessTransactionPaginationParams,
  BusinessTransactionFilters
} from '@glapi/database';

// Define types for lines that are prepared but not yet finalized with transaction/line numbers
// These types omit fields that are added just before database insertion.
type PreparedBusinessLine = Omit<CreateBusinessTransactionLineInput, 'businessTransactionId' | 'lineNumber'>;
type PreparedGlLine = Omit<CreateGlTransactionLineInput, 'transactionId' | 'lineNumber'>;

export class GlTransactionService extends BaseService {
  private subsidiaryService: SubsidiaryService;
  private eventService: EventService;

  constructor(context = {}) {
    super(context);
    this.subsidiaryService = new SubsidiaryService(context);
    this.eventService = new EventService(context);
  }

  /**
   * Emit a transaction event to the event store
   */
  private async emitTransactionEvent(
    eventType: string,
    transaction: BusinessTransaction,
    additionalData?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.eventService.emit({
        eventType,
        eventCategory: EventCategory.TRANSACTION,
        aggregateId: transaction.id ?? '',
        aggregateType: 'BusinessTransaction',
        data: {
          transactionId: transaction.id,
          transactionNumber: transaction.transactionNumber,
          transactionTypeId: transaction.transactionTypeId,
          subsidiaryId: transaction.subsidiaryId ?? '',
          status: transaction.status,
          totalAmount: transaction.totalAmount,
          currencyCode: transaction.currencyCode,
          transactionDate: transaction.transactionDate,
          ...additionalData,
        },
        publishConfig: {
          topic: 'gl-transactions',
          partitionKey: transaction.subsidiaryId ?? '',
        },
      });
    } catch (error) {
      // Log but don't fail the transaction if event emission fails
      console.error('Failed to emit transaction event:', error);
    }
  }

  /**
   * Transform database business transaction to service layer type
   */
  private transformBusinessTransaction(dbTransaction: any): BusinessTransaction {
    return {
      id: dbTransaction.id,
      transactionNumber: dbTransaction.transactionNumber,
      transactionTypeId: dbTransaction.transactionTypeId,
      subsidiaryId: dbTransaction.subsidiaryId,
      entityId: dbTransaction.entityId || undefined,
      entityType: dbTransaction.entityType || undefined,
      transactionDate: dbTransaction.transactionDate,
      dueDate: dbTransaction.dueDate || undefined,
      termsId: dbTransaction.termsId || undefined,
      currencyCode: dbTransaction.currencyCode,
      exchangeRate: dbTransaction.exchangeRate,
      subtotalAmount: dbTransaction.subtotalAmount,
      taxAmount: dbTransaction.taxAmount,
      discountAmount: dbTransaction.discountAmount,
      totalAmount: dbTransaction.totalAmount,
      baseTotalAmount: dbTransaction.baseTotalAmount,
      memo: dbTransaction.memo || undefined,
      externalReference: dbTransaction.externalReference || undefined,
      status: dbTransaction.status as 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'PAID' | 'CLOSED' | 'CANCELLED',
      workflowStatus: dbTransaction.workflowStatus || undefined,
      glTransactionId: dbTransaction.glTransactionId || undefined,
      createdBy: dbTransaction.createdBy || undefined,
      createdDate: dbTransaction.createdDate || undefined,
      modifiedBy: dbTransaction.modifiedBy || undefined,
      modifiedDate: dbTransaction.modifiedDate || undefined,
      approvedBy: dbTransaction.approvedBy || undefined,
      approvedDate: dbTransaction.approvedDate || undefined,
      postedDate: dbTransaction.postedDate || undefined,
      versionNumber: dbTransaction.versionNumber,
    };
  }

  /**
   * Get the primary subsidiary for the organization
   * For now, we'll use the first active subsidiary, but this could be configurable
   */
  private async getPrimarySubsidiaryId(): Promise<string> {
    const organizationId = this.requireOrganizationContext();
    
    const subsidiaries = await this.subsidiaryService.listSubsidiaries(
      { page: 1, limit: 1 },
      'createdAt',
      'asc',
      { isActive: true }
    );
    
    if (!subsidiaries.data.length) {
      throw new ServiceError(
        'No active subsidiary found for this organization',
        'NO_ACTIVE_SUBSIDIARY',
        400
      );
    }
    
    return subsidiaries.data[0].id as string;
  }

  /**
   * Generate transaction number based on type and sequence
   */
  private async generateTransactionNumber(transactionTypeCode: string, subsidiaryId: string): Promise<string> {
    // For now, generate a simple number. In production, this would use the numbering sequence
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    return `${transactionTypeCode}-${year}-${timestamp}`;
  }

  /**
   * Helper to map incoming line data to a structure suitable for CreateBusinessTransactionLineInput,
   * ensuring required fields for creation are present and applying defaults.
   */
  private mapToCreateLineInput(line: CreateBusinessTransactionLineInput | UpdateBusinessTransactionLineInput): PreparedBusinessLine {
    // These fields are essential for creating a line and are assumed to be present in the input
    // for a create operation. If they can be legitimately missing, further validation or error handling
    // would be needed higher up or this function would need to throw.
    if (line.lineType === undefined || line.description === undefined || line.lineAmount === undefined || line.totalLineAmount === undefined) {
      throw new ServiceError('Essential line data (lineType, description, lineAmount, totalLineAmount) is missing for creation.', 'INVALID_LINE_DATA', 400);
    }

    return {
      lineType: line.lineType, 
      description: line.description,
      lineAmount: line.lineAmount,
      totalLineAmount: line.totalLineAmount,

      // Apply defaults for fields that have them in businessTransactionLineSchema
      quantity: line.quantity !== undefined ? line.quantity : '0',
      unitPrice: line.unitPrice !== undefined ? line.unitPrice : '0',
      discountPercent: line.discountPercent !== undefined ? line.discountPercent : '0',
      discountAmount: line.discountAmount !== undefined ? line.discountAmount : '0',
      taxAmount: line.taxAmount !== undefined ? line.taxAmount : '0',
      billableFlag: line.billableFlag !== undefined ? line.billableFlag : true,
      quantityReceived: line.quantityReceived !== undefined ? line.quantityReceived : '0',
      quantityBilled: line.quantityBilled !== undefined ? line.quantityBilled : '0',
      quantityShipped: line.quantityShipped !== undefined ? line.quantityShipped : '0',
      costAmount: line.costAmount !== undefined ? line.costAmount : '0',

      // Optional fields from the schema
      itemId: line.itemId,
      unitOfMeasure: line.unitOfMeasure,
      taxCodeId: line.taxCodeId,
      accountId: line.accountId,
      classId: line.classId,
      departmentId: line.departmentId,
      locationId: line.locationId,
      projectId: line.projectId,
      jobId: line.jobId,
      activityCodeId: line.activityCodeId,
      billingRate: line.billingRate,
      hoursWorked: line.hoursWorked,
      employeeId: line.employeeId,
      workDate: line.workDate,
      parentLineId: line.parentLineId,
      marginAmount: line.marginAmount,
      serialNumbers: line.serialNumbers,
      lotNumbers: line.lotNumbers,
      estimatedHours: line.estimatedHours,
      hourlyRate: line.hourlyRate,
      costEstimate: line.costEstimate,
      notes: line.notes,
      customFields: line.customFields,
    };
  }

  /**
   * Validate that debit and credit amounts balance
   */
  private validateBalances(lines: (PreparedBusinessLine | PreparedGlLine)[]): void {
    let totalDebits = 0;
    let totalCredits = 0;

    for (const line of lines) {
      if ('debitAmount' in line && 'creditAmount' in line) {
        // GL transaction line
        totalDebits += Number(line.debitAmount || 0);
        totalCredits += Number(line.creditAmount || 0);
      } else if ('lineAmount' in line) {
        // Business transaction line - all amounts are typically positive
        totalCredits += Number(line.lineAmount || 0);
      }
    }

    const difference = Math.abs(totalDebits - totalCredits);
    if (difference > 0.01) { // Allow for minor rounding differences
      throw new ServiceError(
        `Transaction is not balanced. Debits: ${totalDebits}, Credits: ${totalCredits}`,
        'TRANSACTION_NOT_BALANCED',
        400
      );
    }
  }

  /**
   * Create a new business transaction with lines
   */
  async createBusinessTransaction(data: BusinessTransactionWithLines): Promise<BusinessTransaction> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    
    // Get or validate subsidiary
    const subsidiaryId = data.transaction.subsidiaryId || await this.getPrimarySubsidiaryId();
    
    // Generate transaction number
    const transactionNumber = await this.generateTransactionNumber('BT', subsidiaryId);
    
    // Prepare lines to conform to CreateBusinessTransactionLineInput structure
    const preparedLines = data.lines.map(line => this.mapToCreateLineInput(line));    
    
    // Validate transaction balances
    this.validateBalances(preparedLines);
    
    // Calculate totals from lines
    const subtotalAmount = preparedLines.reduce((sum, line) => sum + Number(line.lineAmount || 0), 0);
    const taxAmount = preparedLines.reduce((sum, line) => sum + Number(line.taxAmount || 0), 0);
    const discountAmount = preparedLines.reduce((sum, line) => sum + Number(line.discountAmount || 0), 0);
    const totalAmount = subtotalAmount + taxAmount - discountAmount;
    
    const transactionData = {
      ...data.transaction,
      transactionNumber,
      subsidiaryId,
      subtotalAmount: subtotalAmount.toString(),
      taxAmount: taxAmount.toString(),
      discountAmount: discountAmount.toString(),
      totalAmount: totalAmount.toString(),
      baseTotalAmount: (totalAmount * Number(data.transaction.exchangeRate || 1)).toString(),
      createdBy: userId,
      status: data.transaction.status || 'DRAFT',
    };

    try {
      // Create the business transaction
      const result = await glTransactionRepository.create(transactionData, organizationId);

      // Create transaction lines if provided
      if (preparedLines && preparedLines.length > 0) {
        const linesWithTransactionId = preparedLines.map((line, index) => ({
          ...line,
          businessTransactionId: result.id,
          lineNumber: index + 1,
        }));

        await glTransactionRepository.createTransactionLines(linesWithTransactionId, organizationId);
      }

      // Transform and emit event
      const createdTransaction = this.transformBusinessTransaction(result);

      // Emit TransactionCreated event for projections
      await this.emitTransactionEvent(TransactionEvents.CREATED, createdTransaction, {
        lineCount: preparedLines.length,
      });

      return createdTransaction;
    } catch (error) {
      throw new ServiceError(
        `Failed to create business transaction: ${error instanceof Error ? error.message : String(error)}`,
        'CREATION_FAILED',
        500
      );
    }
  }

  /**
   * Update an existing business transaction
   */
  async updateBusinessTransaction(
    id: string, 
    data: BusinessTransactionWithLines
  ): Promise<BusinessTransaction> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    
    // TODO: Implement validation and update logic
    // 1. Check transaction exists and belongs to organization
    // 2. Validate status allows updates
    // 3. Update transaction and lines
    // 4. Recalculate GL if already posted
    
    throw new ServiceError(
      'Business transaction update not yet implemented',
      'NOT_IMPLEMENTED',
      501
    );
  }

  /**
   * Get business transaction by ID
   */
  async getBusinessTransactionById(id: string): Promise<BusinessTransaction | null> {
    const organizationId = this.requireOrganizationContext();
    
    try {
      const result = await glTransactionRepository.findById(id, organizationId);
      
      if (!result) {
        return null;
      }
      
      return this.transformBusinessTransaction(result);
    } catch (error) {
      throw new ServiceError(
        `Failed to get business transaction: ${error instanceof Error ? error.message : String(error)}`,
        'RETRIEVAL_FAILED',
        500
      );
    }
  }

  /**
   * List business transactions
   */
  async listBusinessTransactions(
    params: PaginationParams = {},
    filters: {
      subsidiaryId?: string;
      transactionTypeId?: string;
      status?: string;
      entityId?: string;
      dateFrom?: string | Date;
      dateTo?: string | Date;
    } = {}
  ): Promise<PaginatedResult<BusinessTransaction>> {
    const organizationId = this.requireOrganizationContext();
    
    try {
      const paginationParams: BusinessTransactionPaginationParams = {
        page: params.page,
        limit: params.limit,
        orderBy: 'transactionDate',
        orderDirection: 'desc',
      };
      
      const transactionFilters: BusinessTransactionFilters = {
        subsidiaryId: filters.subsidiaryId,
        transactionTypeId: filters.transactionTypeId,
        status: filters.status,
        entityId: filters.entityId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      };
      
      const result = await glTransactionRepository.findAll(
        organizationId,
        paginationParams,
        transactionFilters
      );
      
      return {
        data: result.data.map(tx => this.transformBusinessTransaction(tx)),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      };
    } catch (error) {
      throw new ServiceError(
        `Failed to list business transactions: ${error instanceof Error ? error.message : String(error)}`,
        'LIST_FAILED',
        500
      );
    }
  }

  /**
   * Post a business transaction to GL
   */
  async postTransaction(request: PostTransactionRequest): Promise<BusinessTransaction> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // TODO: Implement posting logic
    // 1. Validate transaction is in APPROVED status
    // 2. Get posting rules for transaction type
    // 3. Generate GL entries based on rules
    // 4. Create GL transaction and lines
    // 5. Update business transaction status to POSTED
    // 6. Emit TransactionPosted event (triggers balance projection worker)
    //    await this.emitTransactionEvent(TransactionEvents.POSTED, postedTransaction, {
    //      glTransactionId: glTransaction.id,
    //      periodId: periodId,
    //      glLines: glLines.map(line => ({
    //        accountId: line.accountId,
    //        debitAmount: line.debitAmount,
    //        creditAmount: line.creditAmount,
    //      })),
    //    });

    throw new ServiceError(
      'Transaction posting not yet implemented',
      'NOT_IMPLEMENTED',
      501
    );
  }

  /**
   * Reverse a posted transaction
   */
  async reverseTransaction(request: ReverseTransactionRequest): Promise<BusinessTransaction> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    // TODO: Implement reversal logic
    // 1. Validate transaction is POSTED and can be reversed
    // 2. Create reversing GL entries
    // 3. Update original transaction status
    // 4. Emit TransactionReversed event (triggers balance projection worker)
    //    await this.emitTransactionEvent(TransactionEvents.REVERSED, reversedTransaction, {
    //      originalGlTransactionId: originalGlTransaction.id,
    //      reversalGlTransactionId: reversalGlTransaction.id,
    //      reversalDate: request.reversalDate,
    //      reason: request.reason,
    //      glLines: reversalLines.map(line => ({
    //        accountId: line.accountId,
    //        debitAmount: line.debitAmount,
    //        creditAmount: line.creditAmount,
    //      })),
    //    });

    throw new ServiceError(
      'Transaction reversal not yet implemented',
      'NOT_IMPLEMENTED',
      501
    );
  }

  /**
   * Approve a transaction for posting
   */
  async approveTransaction(request: ApproveTransactionRequest): Promise<BusinessTransaction> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    
    try {
      // Get the transaction to validate current status
      const transaction = await this.getBusinessTransactionById(request.transactionId);
      if (!transaction) {
        throw new ServiceError(
          'Transaction not found',
          'TRANSACTION_NOT_FOUND',
          404
        );
      }
      
      // Validate transaction can be approved
      if (transaction.status !== 'PENDING_APPROVAL') {
        throw new ServiceError(
          `Transaction cannot be approved from status: ${transaction.status}`,
          'INVALID_STATUS_TRANSITION',
          400
        );
      }
      
      // Update transaction status to APPROVED
      const result = await glTransactionRepository.updateStatus(
        request.transactionId,
        'APPROVED',
        userId,
        organizationId
      );

      if (!result) {
        throw new ServiceError(
          'Failed to approve transaction',
          'APPROVAL_FAILED',
          500
        );
      }

      const approvedTransaction: BusinessTransaction = {
        ...transaction,
        status: result.status as 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'PAID' | 'CLOSED' | 'CANCELLED',
        approvedBy: result.approvedBy || undefined,
        approvedDate: result.approvedDate || undefined,
        modifiedBy: result.modifiedBy || undefined,
        modifiedDate: result.modifiedDate || undefined,
      };

      // Emit TransactionApproved event for projections
      await this.emitTransactionEvent(TransactionEvents.APPROVED, approvedTransaction, {
        approvedBy: userId,
        approvedDate: result.approvedDate,
      });

      return approvedTransaction;
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError(
        `Failed to approve transaction: ${error instanceof Error ? error.message : String(error)}`,
        'APPROVAL_FAILED',
        500
      );
    }
  }

  /**
   * Delete a transaction (only if in DRAFT status)
   */
  async deleteBusinessTransaction(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    try {
      // Get the transaction to validate current status
      const transaction = await this.getBusinessTransactionById(id);
      if (!transaction) {
        throw new ServiceError(
          'Transaction not found',
          'TRANSACTION_NOT_FOUND',
          404
        );
      }
      
      // Validate transaction can be deleted
      if (transaction.status !== 'DRAFT') {
        throw new ServiceError(
          `Transaction cannot be deleted from status: ${transaction.status}`,
          'INVALID_STATUS_FOR_DELETION',
          400
        );
      }
      
      // Delete the transaction (repository handles lines via cascade)
      await glTransactionRepository.delete(id, organizationId);
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError(
        `Failed to delete transaction: ${error instanceof Error ? error.message : String(error)}`,
        'DELETION_FAILED',
        500
      );
    }
  }
}