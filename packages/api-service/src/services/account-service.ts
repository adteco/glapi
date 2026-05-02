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
import { AccountRepository, type ContextualDatabase } from '@glapi/database';

export interface AccountServiceOptions {
  db?: ContextualDatabase;
}

export class AccountService extends BaseService {
  private accountRepository: AccountRepository;

  constructor(context = {}, options: AccountServiceOptions = {}) {
    super(context);
    // Pass the contextual db to the repository for RLS support
    this.accountRepository = new AccountRepository(options.db);
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
      organizationId,
      accountNumber: input.accountNumber,
      accountName: input.accountName,
      accountCategory: input.accountCategory,
      description: input.description,
      isActive: input.isActive,
      isControlAccount: input.isControlAccount,
      accountSubcategory: input.accountSubcategory,
      normalBalance: input.normalBalance,
      financialStatementLine: input.financialStatementLine,
      rollupAccountId: input.rollupAccountId,
      gaapClassification: input.gaapClassification,
      cashFlowCategory: input.cashFlowCategory
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
    skipped: number;
    failed: number;
    total: number;
  }> {
    const organizationId = this.requireOrganizationContext();

    const existingAccounts = await this.accountRepository.findAllNoPagination(organizationId);
    const seenAccountNumbers = new Set(
      existingAccounts.map(account => account.accountNumber)
    );

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const failures: unknown[] = [];

    for (const account of defaultAccounts) {
      if (seenAccountNumbers.has(account.accountNumber)) {
        skipped += 1;
        continue;
      }

      // Reserve the number in-memory before inserting so duplicate defaults in
      // the seed input cannot race each other.
      seenAccountNumbers.add(account.accountNumber);

      try {
        await this.createAccount({
          ...account,
          organizationId,
          isControlAccount: account.isControlAccount ?? false,
          isActive: account.isActive ?? true
        });
        created += 1;
      } catch (error) {
        if (error instanceof ServiceError && error.code === 'ACCOUNT_NUMBER_EXISTS') {
          skipped += 1;
          continue;
        }

        failed += 1;
        failures.push(error);
      }
    }
    
    // Log the first few errors to help debug
    if (failures.length > 0) {
      console.error('Account seeding errors:');
      failures.slice(0, 3).forEach((failure, index) => {
        console.error(`Error ${index + 1}:`, failure);
      });
    }
    
    return {
      created,
      skipped,
      failed,
      total: defaultAccounts.length
    };
  }
  
  /**
   * Health check for the service layer
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      // Simple check to verify service layer is working
      return {
        status: 'healthy',
        message: 'AccountService is operational'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Service health check failed'
      };
    }
  }
  
  /**
   * Check database connection through repository
   */
  async checkDatabaseConnection(): Promise<{ status: string; message: string }> {
    try {
      // Try to list accounts with a limit of 1 to test database connection
      const organizationId = this.requireOrganizationContext();
      const result = await this.accountRepository.findAll(
        organizationId,
        { page: 1, limit: 1 },
        {}
      );
      
      // If we get here without error, database is connected
      return {
        status: 'healthy',
        message: `Database connection is active. Found ${result.pagination.total} accounts.`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown database error'}`
      };
    }
  }
}
