import { BaseService } from './base-service';
import { 
  BusinessTransaction,
  BusinessTransactionLine,
  BusinessTransactionWithLines,
  CreateBusinessTransactionInput,
  UpdateBusinessTransactionInput,
  CreateBusinessTransactionLineInput,
  UpdateBusinessTransactionLineInput,
  PostTransactionRequest,
  ReverseTransactionRequest,
  ApproveTransactionRequest,
  PaginationParams, 
  PaginatedResult,
  ServiceError
} from '../types';
import { SubsidiaryService } from './subsidiary-service';
import { glTransactionRepository } from '@glapi/database/repositories';
import type { 
  BusinessTransactionPaginationParams, 
  BusinessTransactionFilters 
} from '@glapi/database/repositories/gl-transaction-repository';

export class GlTransactionService extends BaseService {
  private subsidiaryService: SubsidiaryService;
  
  constructor(context = {}) {
    super(context);
    this.subsidiaryService = new SubsidiaryService(context);
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
    
    return subsidiaries.data[0].id;
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
   * Validate that debit and credit amounts balance
   */
  private validateBalances(lines: (CreateBusinessTransactionLineInput | CreateGlTransactionLineInput)[]): void {
    let totalDebits = 0;
    let totalCredits = 0;

    for (const line of lines) {
      if ('debitAmount' in line && 'creditAmount' in line) {
        // GL transaction line
        totalDebits += Number(line.debitAmount || 0);
        totalCredits += Number(line.creditAmount || 0);
      } else {
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
    
    // Validate transaction balances
    this.validateBalances(data.lines);
    
    // Calculate totals from lines
    const subtotalAmount = data.lines.reduce((sum, line) => sum + Number(line.lineAmount || 0), 0);
    const taxAmount = data.lines.reduce((sum, line) => sum + Number(line.taxAmount || 0), 0);
    const discountAmount = data.lines.reduce((sum, line) => sum + Number(line.discountAmount || 0), 0);
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
      if (data.lines && data.lines.length > 0) {
        const linesWithTransactionId = data.lines.map((line, index) => ({
          ...line,
          businessTransactionId: result.id,
          lineNumber: index + 1,
        }));
        
        await glTransactionRepository.createTransactionLines(linesWithTransactionId, organizationId);
      }
      
      // Return the created transaction
      return {
        id: result.id,
        transactionNumber: result.transactionNumber,
        transactionTypeId: result.transactionTypeId,
        subsidiaryId: result.subsidiaryId,
        entityId: result.entityId,
        entityType: result.entityType,
        transactionDate: result.transactionDate,
        dueDate: result.dueDate,
        termsId: result.termsId,
        currencyCode: result.currencyCode,
        exchangeRate: result.exchangeRate,
        subtotalAmount: result.subtotalAmount,
        taxAmount: result.taxAmount,
        discountAmount: result.discountAmount,
        totalAmount: result.totalAmount,
        baseTotalAmount: result.baseTotalAmount,
        memo: result.memo,
        externalReference: result.externalReference,
        status: result.status,
        workflowStatus: result.workflowStatus,
        glTransactionId: result.glTransactionId,
        createdBy: result.createdBy,
        createdDate: result.createdDate,
        modifiedBy: result.modifiedBy,
        modifiedDate: result.modifiedDate,
        approvedBy: result.approvedBy,
        approvedDate: result.approvedDate,
        postedDate: result.postedDate,
        versionNumber: result.versionNumber,
      };
    } catch (error) {
      throw new ServiceError(
        `Failed to create business transaction: ${error.message}`,
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
      
      return {
        id: result.id,
        transactionNumber: result.transactionNumber,
        transactionTypeId: result.transactionTypeId,
        subsidiaryId: result.subsidiaryId,
        entityId: result.entityId,
        entityType: result.entityType,
        transactionDate: result.transactionDate,
        dueDate: result.dueDate,
        termsId: result.termsId,
        currencyCode: result.currencyCode,
        exchangeRate: result.exchangeRate,
        subtotalAmount: result.subtotalAmount,
        taxAmount: result.taxAmount,
        discountAmount: result.discountAmount,
        totalAmount: result.totalAmount,
        baseTotalAmount: result.baseTotalAmount,
        memo: result.memo,
        externalReference: result.externalReference,
        status: result.status,
        workflowStatus: result.workflowStatus,
        glTransactionId: result.glTransactionId,
        createdBy: result.createdBy,
        createdDate: result.createdDate,
        modifiedBy: result.modifiedBy,
        modifiedDate: result.modifiedDate,
        approvedBy: result.approvedBy,
        approvedDate: result.approvedDate,
        postedDate: result.postedDate,
        versionNumber: result.versionNumber,
      };
    } catch (error) {
      throw new ServiceError(
        `Failed to get business transaction: ${error.message}`,
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
        data: result.data.map(tx => ({
          id: tx.id,
          transactionNumber: tx.transactionNumber,
          transactionTypeId: tx.transactionTypeId,
          subsidiaryId: tx.subsidiaryId,
          entityId: tx.entityId,
          entityType: tx.entityType,
          transactionDate: tx.transactionDate,
          totalAmount: tx.totalAmount,
          status: tx.status,
          memo: tx.memo,
          createdDate: tx.createdDate,
          // Add other required fields with defaults
          dueDate: null,
          termsId: null,
          currencyCode: 'USD',
          exchangeRate: '1',
          subtotalAmount: '0',
          taxAmount: '0',
          discountAmount: '0',
          baseTotalAmount: tx.totalAmount,
          externalReference: null,
          workflowStatus: null,
          glTransactionId: null,
          createdBy: null,
          modifiedBy: null,
          modifiedDate: null,
          approvedBy: null,
          approvedDate: null,
          postedDate: null,
          versionNumber: 1,
        })),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      };
    } catch (error) {
      throw new ServiceError(
        `Failed to list business transactions: ${error.message}`,
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
    // 6. Update account balances
    
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
    // 4. Update account balances
    
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
      
      return {
        ...transaction,
        status: result.status,
        approvedBy: result.approvedBy,
        approvedDate: result.approvedDate,
        modifiedBy: result.modifiedBy,
        modifiedDate: result.modifiedDate,
      };
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError(
        `Failed to approve transaction: ${error.message}`,
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
        `Failed to delete transaction: ${error.message}`,
        'DELETION_FAILED',
        500
      );
    }
  }
}