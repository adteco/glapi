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
    
    const transactionData: CreateBusinessTransactionInput = {
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

    // TODO: Implement database operations
    // This would use a repository to:
    // 1. Create the business transaction
    // 2. Create the transaction lines
    // 3. If status is POSTED, generate GL entries
    
    throw new ServiceError(
      'Business transaction creation not yet implemented',
      'NOT_IMPLEMENTED',
      501
    );
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
    
    // TODO: Implement repository call with subsidiary filtering
    throw new ServiceError(
      'Get business transaction not yet implemented',
      'NOT_IMPLEMENTED',
      501
    );
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
    
    // TODO: Implement repository call with organization/subsidiary filtering
    throw new ServiceError(
      'List business transactions not yet implemented',
      'NOT_IMPLEMENTED',
      501
    );
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
    
    // TODO: Implement approval logic
    // 1. Validate transaction is in PENDING_APPROVAL status
    // 2. Check user has approval permissions
    // 3. Update transaction status to APPROVED
    // 4. Add approval audit trail
    
    throw new ServiceError(
      'Transaction approval not yet implemented',
      'NOT_IMPLEMENTED',
      501
    );
  }

  /**
   * Delete a transaction (only if in DRAFT status)
   */
  async deleteBusinessTransaction(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    // TODO: Implement deletion logic
    // 1. Validate transaction exists and belongs to organization
    // 2. Validate transaction is in DRAFT status
    // 3. Delete transaction lines and transaction
    
    throw new ServiceError(
      'Transaction deletion not yet implemented',
      'NOT_IMPLEMENTED',
      501
    );
  }
}