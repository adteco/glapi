import { BaseService } from './base-service';
import { 
  Account, 
  CreateAccountInput, 
  UpdateAccountInput, 
  PaginationParams, 
  PaginatedResult,
  ServiceError,
  AccountFilters
} from '../types';
import { AccountRepository } from '@glapi/database';

export class AccountService extends BaseService {
  private accountRepository: AccountRepository;
  
  constructor(context = {}) {
    super(context);
    this.accountRepository = new AccountRepository();
  }
  /**
   * Transform database account to service layer type
   */
  private transformAccount(dbAccount: any): Account {
    return {
      id: dbAccount.id,
      organizationId: dbAccount.organizationId,
      accountNumber: dbAccount.accountNumber,
      accountName: dbAccount.accountName,
      accountCategory: dbAccount.accountCategory,
      accountSubcategory: dbAccount.accountSubcategory || undefined,
      normalBalance: dbAccount.normalBalance || undefined,
      financialStatementLine: dbAccount.financialStatementLine || undefined,
      isControlAccount: dbAccount.isControlAccount,
      rollupAccountId: dbAccount.rollupAccountId || undefined,
      gaapClassification: dbAccount.gaapClassification || undefined,
      cashFlowCategory: dbAccount.cashFlowCategory || undefined,
      description: dbAccount.description || undefined,
      isActive: dbAccount.isActive,
      createdAt: dbAccount.createdAt || new Date(),
      updatedAt: dbAccount.updatedAt || new Date(),
    };
  }
  
  /**
   * Get a list of accounts for the current organization
   */
  async listAccounts(
    params: PaginationParams = {},
    orderBy: 'accountNumber' | 'accountName' | 'createdAt' = 'accountNumber',
    orderDirection: 'asc' | 'desc' = 'asc',
    filters: AccountFilters = {}
  ): Promise<PaginatedResult<Account>> {
    const organizationId = this.requireOrganizationContext();
    
    const result = await this.accountRepository.findAll(
      organizationId,
      {
        page: params.page,
        limit: params.limit,
        orderBy,
        orderDirection
      },
      filters
    );
    
    return {
      data: result.data.map(account => this.transformAccount(account)),
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit,
      totalPages: result.pagination.pages
    };
  }
  
  /**
   * Get a single account by ID
   */
  async getAccountById(accountId: string): Promise<Account> {
    const organizationId = this.requireOrganizationContext();
    
    const account = await this.accountRepository.findById(accountId, organizationId);
    
    if (!account) {
      throw new ServiceError(
        'Account not found',
        'ACCOUNT_NOT_FOUND',
        404
      );
    }
    
    return this.transformAccount(account);
  }
  
  /**
   * Get a single account by account number
   */
  async getAccountByNumber(accountNumber: string): Promise<Account | null> {
    const organizationId = this.requireOrganizationContext();
    
    const account = await this.accountRepository.findByAccountNumber(accountNumber, organizationId);
    
    if (!account) {
      return null;
    }
    
    return this.transformAccount(account);
  }
  
  /**
   * Create a new account
   */
  async createAccount(input: CreateAccountInput): Promise<Account> {
    const organizationId = this.requireOrganizationContext();
    
    // Ensure organizationId matches context
    if (input.organizationId && input.organizationId !== organizationId) {
      throw new ServiceError(
        'Organization ID mismatch',
        'INVALID_ORGANIZATION',
        400
      );
    }
    
    // Check if account number already exists
    const existing = await this.accountRepository.findByAccountNumber(input.accountNumber, organizationId);
    if (existing) {
      throw new ServiceError(
        `Account with number ${input.accountNumber} already exists`,
        'ACCOUNT_NUMBER_EXISTS',
        409
      );
    }
    
    const accountData = {
      ...input,
      organizationId
    };
    
    const newAccount = await this.accountRepository.create(accountData);
    
    return this.transformAccount(newAccount);
  }
  
  /**
   * Update an existing account
   */
  async updateAccount(accountId: string, input: UpdateAccountInput): Promise<Account> {
    const organizationId = this.requireOrganizationContext();
    
    // Check if account exists
    const existingAccount = await this.accountRepository.findById(accountId, organizationId);
    if (!existingAccount) {
      throw new ServiceError(
        'Account not found',
        'ACCOUNT_NOT_FOUND',
        404
      );
    }
    
    // If changing account number, check if new number already exists
    if (input.accountNumber && input.accountNumber !== existingAccount.accountNumber) {
      const duplicate = await this.accountRepository.findByAccountNumber(input.accountNumber, organizationId);
      if (duplicate) {
        throw new ServiceError(
          `Account with number ${input.accountNumber} already exists`,
          'ACCOUNT_NUMBER_EXISTS',
          409
        );
      }
    }
    
    const updatedAccount = await this.accountRepository.update(accountId, organizationId, input);
    
    if (!updatedAccount) {
      throw new ServiceError(
        'Failed to update account',
        'UPDATE_FAILED',
        500
      );
    }
    
    return this.transformAccount(updatedAccount);
  }
  
  /**
   * Delete an account
   */
  async deleteAccount(accountId: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    // Check if account exists
    const existingAccount = await this.accountRepository.findById(accountId, organizationId);
    if (!existingAccount) {
      throw new ServiceError(
        'Account not found',
        'ACCOUNT_NOT_FOUND',
        404
      );
    }
    
    // TODO: Check if account has transactions before deleting
    // This would require checking gl_transaction_lines table
    
    const success = await this.accountRepository.delete(accountId, organizationId);
    
    if (!success) {
      throw new ServiceError(
        'Failed to delete account',
        'DELETE_FAILED',
        500
      );
    }
  }
  
  /**
   * Seed default accounts for an organization
   */
  async seedDefaultAccounts(defaultAccounts: Array<{
    accountNumber: string;
    accountName: string;
    accountCategory: "Asset" | "Liability" | "Equity" | "Revenue" | "COGS" | "Expense";
    description?: string;
    isControlAccount?: boolean;
    isActive?: boolean;
  }>): Promise<{
    created: number;
    failed: number;
    total: number;
  }> {
    const organizationId = this.requireOrganizationContext();
    
    const results = await Promise.allSettled(
      defaultAccounts.map(account => 
        this.createAccount({
          ...account,
          organizationId,
          isControlAccount: account.isControlAccount ?? false,
          isActive: account.isActive ?? true
        })
      )
    );
    
    const created = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    return {
      created,
      failed,
      total: defaultAccounts.length
    };
  }
}