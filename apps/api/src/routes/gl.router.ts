import express, { Router, Request, Response, NextFunction } from 'express';
import { accountRepository } from '@glapi/database';
import { 
  GlTransactionService, 
  GlReportingService,
  createBusinessTransactionSchema,
  updateBusinessTransactionSchema,
  ServiceError
} from '@glapi/api-service';

// Extend Request to include organizationContext
interface AuthenticatedRequest extends Request {
  organizationContext?: {
    organizationId: string;
    userId: string;
    stytchOrganizationId: string;
  };
}

const router: Router = express.Router();

// Helper to get organization context from request
const getServiceContext = (req: Request) => {
  const context = (req as any).organizationContext;

  if (!context || !context.organizationId) {
    console.warn('Organization context not found in request - using development fallback');

    // Return a development fallback context when none is available
    return {
      organizationId: 'org_development', // Match clerk-auth middleware fallback
      userId: 'user_development', // Match clerk-auth middleware fallback
      stytchOrganizationId: 'org_development'
    };
  }

  console.log('Using organization context:', context);
  return context;
};

const defaultAccounts = [
  // ASSETS (10000-19999) - SUMMARY ACCOUNT
  { account_number: "10000", account_name: "Assets", account_category: "Asset" as const, description: "Total assets" },
  { account_number: "10100", account_name: "Cash", account_category: "Asset" as const, description: "Cash and cash equivalents" },
  { account_number: "11000", account_name: "Bank", account_category: "Asset" as const, description: "Bank accounts and deposits" },
  { account_number: "12000", account_name: "Accounts Receivable", account_category: "Asset" as const, description: "Money owed by customers" },
  { account_number: "13000", account_name: "Prepaid Expenses", account_category: "Asset" as const, description: "Expenses paid in advance" },
  { account_number: "14000", account_name: "Inventory", account_category: "Asset" as const, description: "Goods for sale" },
  { account_number: "15000", account_name: "Fixed Assets", account_category: "Asset" as const, description: "Long-term assets like equipment and property" },
  { account_number: "15100", account_name: "Accumulated Depreciation", account_category: "Asset" as const, description: "Accumulated depreciation on fixed assets (contra)" },

  // LIABILITIES (20000-29999) - SUMMARY ACCOUNT
  { account_number: "20000", account_name: "Liabilities", account_category: "Liability" as const, description: "Total liabilities" },
  { account_number: "21000", account_name: "Accounts Payable", account_category: "Liability" as const, description: "Money owed to suppliers" },
  { account_number: "22000", account_name: "Accrued Liabilities", account_category: "Liability" as const, description: "Expenses incurred but not yet paid" },
  { account_number: "23000", account_name: "Notes Payable", account_category: "Liability" as const, description: "Short-term loans and notes payable" },

  // EQUITY (30000-39999) - SUMMARY ACCOUNT
  { account_number: "30000", account_name: "Equity", account_category: "Equity" as const, description: "Total equity" },
  { account_number: "31000", account_name: "Retained Earnings", account_category: "Equity" as const, description: "Cumulative net income retained in the business" },

  // REVENUE (40000-49999) - SUMMARY ACCOUNT
  { account_number: "40000", account_name: "Revenue", account_category: "Revenue" as const, description: "Total revenue" },
  { account_number: "41000", account_name: "Sales Revenue", account_category: "Revenue" as const, description: "Income from sales of products" },
  { account_number: "42000", account_name: "Service Revenue", account_category: "Revenue" as const, description: "Income from services provided" },

  // COST OF GOODS SOLD (50000-59999) - SUMMARY ACCOUNT
  { account_number: "50000", account_name: "Cost of Goods Sold", account_category: "COGS" as const, description: "Total direct costs of producing goods sold" },

  // OPERATING EXPENSES (60000-69999) - SUMMARY ACCOUNT
  { account_number: "60000", account_name: "Operating Expenses", account_category: "Expense" as const, description: "Total operating expenses" },
  { account_number: "61000", account_name: "Payroll Expense", account_category: "Expense" as const, description: "Employee wages and salaries" },
  { account_number: "62000", account_name: "Utilities Expense", account_category: "Expense" as const, description: "Cost of utilities like electricity, water, etc." },
  { account_number: "63000", account_name: "Marketing Expense", account_category: "Expense" as const, description: "Advertising and marketing costs" },
  { account_number: "64000", account_name: "Office Supplies", account_category: "Expense" as const, description: "Cost of office supplies and materials" },
  { account_number: "65000", account_name: "Rent Expense", account_category: "Expense" as const, description: "Cost of renting facilities" },
  { account_number: "66000", account_name: "Bank Fees", account_category: "Expense" as const, description: "Banking and financial service fees" },

  // ADMINISTRATIVE EXPENSES (70000-79999) - SUMMARY ACCOUNT
  { account_number: "70000", account_name: "Administrative Expenses", account_category: "Expense" as const, description: "Total administrative and general expenses" },
  { account_number: "70100", account_name: "Bad Debt Expense", account_category: "Expense" as const, description: "Estimated uncollectible accounts receivable" },
  { account_number: "70200", account_name: "Legal and Professional Fees", account_category: "Expense" as const, description: "Attorney, accounting, and consulting fees" },
  { account_number: "70300", account_name: "Insurance Expense", account_category: "Expense" as const, description: "Business insurance premiums" },
  { account_number: "70400", account_name: "Depreciation Expense", account_category: "Expense" as const, description: "Depreciation of fixed assets" },
  { account_number: "70500", account_name: "Travel and Entertainment", account_category: "Expense" as const, description: "Business travel and entertainment costs" },
  { account_number: "70600", account_name: "Repairs and Maintenance", account_category: "Expense" as const, description: "Equipment and facility maintenance costs" },

  // OTHER INCOME (80000-89999) - SUMMARY ACCOUNT
  { account_number: "80000", account_name: "Other Income", account_category: "Revenue" as const, description: "Total non-operating income" },
  { account_number: "81000", account_name: "Interest Income", account_category: "Revenue" as const, description: "Income from interest on investments or loans" },
  { account_number: "82000", account_name: "Gain on Sale of Assets", account_category: "Revenue" as const, description: "Profits from selling company assets" },

  // OTHER EXPENSES (90000-99999) - SUMMARY ACCOUNT
  { account_number: "90000", account_name: "Other Expenses", account_category: "Expense" as const, description: "Total non-operating expenses" },
  { account_number: "91000", account_name: "Interest Expense", account_category: "Expense" as const, description: "Interest paid on loans and debt" },
  { account_number: "92000", account_name: "Loss on Sale of Assets", account_category: "Expense" as const, description: "Losses from selling company assets" },
  { account_number: "93000", account_name: "Extraordinary Losses", account_category: "Expense" as const, description: "Unusual, non-recurring losses" },
];

// POST /api/v1/gl/accounts/seed - Seed default accounts for an organization
router.post(
  '/accounts/seed',
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.organizationContext?.organizationId) {
      return res.status(401).json({ error: 'Organization ID not found in session.' });
    }
    const orgId = req.organizationContext.organizationId;

    try {
      // 1. Check if accounts already exist for this organization
      const accountsExist = await accountRepository.existsForOrganization(orgId);

      if (accountsExist) {
        return res.status(409).json({ message: 'Accounts already exist for this organization.' });
      }

      // 2. If not, seed the default accounts
      const accountsToSeed = defaultAccounts.map(acc => ({
        ...acc,
        organizationId: orgId,
        accountCategory: acc.account_category,
        accountNumber: acc.account_number,
        accountName: acc.account_name,
      }));

      const newAccounts = await accountRepository.createMany(accountsToSeed);

      return res.status(201).json({ 
        message: 'Default accounts seeded successfully.', 
        data: newAccounts,
        count: newAccounts.length 
      });
    } catch (error) {
      console.error('Unexpected error during account seeding:', error);
      return res.status(500).json({ error: 'An unexpected error occurred while seeding accounts.' });
    }
  }
);

// GET /api/v1/gl/accounts - List accounts for an organization
router.get(
  '/accounts',
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.organizationContext?.organizationId) {
      return res.status(401).json({ error: 'Organization ID not found in session.' });
    }
    const orgId = req.organizationContext.organizationId;

    try {
      // For the simple list view, we'll get all accounts without pagination
      const accounts = await accountRepository.findAllNoPagination(orgId);

      return res.status(200).json(accounts);
    } catch (error) {
      console.error('Unexpected error fetching accounts:', error);
      return res.status(500).json({ error: 'An unexpected error occurred while fetching accounts.' });
    }
  }
);

// GET /api/v1/gl/accounts/:id - Get a specific account
router.get(
  '/accounts/:id',
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.organizationContext?.organizationId) {
      return res.status(401).json({ error: 'Organization ID not found in session.' });
    }
    const orgId = req.organizationContext.organizationId;
    const { id } = req.params;

    try {
      const account = await accountRepository.findById(id, orgId);

      if (!account) {
        return res.status(404).json({ error: 'Account not found.' });
      }

      return res.status(200).json(account);
    } catch (error) {
      console.error('Unexpected error fetching account:', error);
      return res.status(500).json({ error: 'An unexpected error occurred while fetching the account.' });
    }
  }
);

// POST /api/v1/gl/accounts - Create a new account
router.post(
  '/accounts',
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.organizationContext?.organizationId) {
      return res.status(401).json({ error: 'Organization ID not found in session.' });
    }
    const orgId = req.organizationContext.organizationId;

    try {
      const { accountNumber, accountName, accountCategory, description, isActive } = req.body;

      // Basic validation
      if (!accountNumber || !accountName || !accountCategory) {
        return res.status(400).json({ 
          error: 'Missing required fields: accountNumber, accountName, and accountCategory are required.' 
        });
      }

      // Validate account category
      const validCategories = ['Asset', 'Liability', 'Equity', 'Revenue', 'COGS', 'Expense'];
      if (!validCategories.includes(accountCategory)) {
        return res.status(400).json({ 
          error: `Invalid account category. Must be one of: ${validCategories.join(', ')}` 
        });
      }

      const newAccount = await accountRepository.create({
        organizationId: orgId,
        accountNumber,
        accountName,
        accountCategory: accountCategory as any,
        description,
        isActive: isActive ?? true,
      });

      return res.status(201).json(newAccount);
    } catch (error: any) {
      console.error('Error creating account:', error);
      
      // Check for unique constraint violation
      if (error.code === '23505' && error.constraint === 'accounts_organization_id_account_number_idx') {
        return res.status(409).json({ 
          error: 'An account with this account number already exists for your organization.' 
        });
      }

      return res.status(500).json({ error: 'An unexpected error occurred while creating the account.' });
    }
  }
);

// PUT /api/v1/gl/accounts/:id - Update an account
router.put(
  '/accounts/:id',
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.organizationContext?.organizationId) {
      return res.status(401).json({ error: 'Organization ID not found in session.' });
    }
    const orgId = req.organizationContext.organizationId;
    const { id } = req.params;

    try {
      const { accountNumber, accountName, accountCategory, description, isActive } = req.body;

      // Validate account category if provided
      if (accountCategory) {
        const validCategories = ['Asset', 'Liability', 'Equity', 'Revenue', 'COGS', 'Expense'];
        if (!validCategories.includes(accountCategory)) {
          return res.status(400).json({ 
            error: `Invalid account category. Must be one of: ${validCategories.join(', ')}` 
          });
        }
      }

      const updatedAccount = await accountRepository.update(id, orgId, {
        accountNumber,
        accountName,
        accountCategory: accountCategory as any,
        description,
        isActive,
      });

      if (!updatedAccount) {
        return res.status(404).json({ error: 'Account not found.' });
      }

      return res.status(200).json(updatedAccount);
    } catch (error: any) {
      console.error('Error updating account:', error);
      
      // Check for unique constraint violation
      if (error.code === '23505' && error.constraint === 'accounts_organization_id_account_number_idx') {
        return res.status(409).json({ 
          error: 'An account with this account number already exists for your organization.' 
        });
      }

      return res.status(500).json({ error: 'An unexpected error occurred while updating the account.' });
    }
  }
);

// DELETE /api/v1/gl/accounts/:id - Delete an account (soft delete)
router.delete(
  '/accounts/:id',
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.organizationContext?.organizationId) {
      return res.status(401).json({ error: 'Organization ID not found in session.' });
    }
    const orgId = req.organizationContext.organizationId;
    const { id } = req.params;

    try {
      const deletedAccount = await accountRepository.delete(id, orgId);

      if (!deletedAccount) {
        return res.status(404).json({ error: 'Account not found.' });
      }

      return res.status(200).json({ 
        message: 'Account deleted successfully.', 
        data: deletedAccount 
      });
    } catch (error) {
      console.error('Error deleting account:', error);
      return res.status(500).json({ error: 'An unexpected error occurred while deleting the account.' });
    }
  }
);

// BUSINESS TRANSACTIONS ROUTES

// POST /api/v1/gl/transactions - Create a new business transaction
router.post('/transactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = getServiceContext(req);
    console.log('Creating business transaction with context:', context);

    // Validate request body
    const parsedData = createBusinessTransactionSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({
        message: 'Invalid transaction data',
        errors: parsedData.error.errors
      });
    }

    const glTransactionService = new GlTransactionService(context);
    const result = await glTransactionService.createBusinessTransaction(parsedData.data);

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error creating business transaction:', error);
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode).json({
        message: serviceError.message,
        code: serviceError.code,
        details: serviceError.details
      });
    }
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message });
    }
    next(error);
  }
});

// GET /api/v1/gl/transactions - List business transactions
router.get('/transactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = getServiceContext(req);
    
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const subsidiaryId = req.query.subsidiaryId as string;
    const transactionTypeId = req.query.transactionTypeId as string;
    const status = req.query.status as string;
    const entityId = req.query.entityId as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;

    const glTransactionService = new GlTransactionService(context);
    const result = await glTransactionService.listBusinessTransactions(
      { page, limit },
      { subsidiaryId, transactionTypeId, status, entityId, dateFrom, dateTo }
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error listing business transactions:', error);
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode).json({
        message: serviceError.message,
        code: serviceError.code,
        details: serviceError.details
      });
    }
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message });
    }
    next(error);
  }
});

// GET /api/v1/gl/transactions/:id - Get a business transaction by ID
router.get('/transactions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const context = getServiceContext(req);

    const glTransactionService = new GlTransactionService(context);
    const result = await glTransactionService.getBusinessTransactionById(id);

    if (!result) {
      return res.status(404).json({
        message: `Business transaction with ID "${id}" not found`
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting business transaction:', error);
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode).json({
        message: serviceError.message,
        code: serviceError.code,
        details: serviceError.details
      });
    }
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message });
    }
    next(error);
  }
});

// PUT /api/v1/gl/transactions/:id - Update a business transaction
router.put('/transactions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const context = getServiceContext(req);

    // Validate request body
    const parsedData = updateBusinessTransactionSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({
        message: 'Invalid transaction data',
        errors: parsedData.error.errors
      });
    }

    const glTransactionService = new GlTransactionService(context);
    const result = await glTransactionService.updateBusinessTransaction(id, parsedData.data);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error updating business transaction:', error);
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode).json({
        message: serviceError.message,
        code: serviceError.code,
        details: serviceError.details
      });
    }
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message });
    }
    next(error);
  }
});

// DELETE /api/v1/gl/transactions/:id - Delete a business transaction
router.delete('/transactions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const context = getServiceContext(req);

    const glTransactionService = new GlTransactionService(context);
    await glTransactionService.deleteBusinessTransaction(id);

    return res.status(200).json({
      success: true,
      message: 'Business transaction deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting business transaction:', error);
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode).json({
        message: serviceError.message,
        code: serviceError.code,
        details: serviceError.details
      });
    }
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message });
    }
    next(error);
  }
});

// TRANSACTION ACTIONS

// POST /api/v1/gl/transactions/:id/post - Post a transaction to GL
router.post('/transactions/:id/post', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const context = getServiceContext(req);
    const { postingDate, overrideChecks } = req.body;

    const glTransactionService = new GlTransactionService(context);
    const result = await glTransactionService.postTransaction({
      transactionId: id,
      postingDate,
      overrideChecks
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error posting transaction:', error);
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode).json({
        message: serviceError.message,
        code: serviceError.code,
        details: serviceError.details
      });
    }
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message });
    }
    next(error);
  }
});

// POST /api/v1/gl/transactions/:id/reverse - Reverse a posted transaction
router.post('/transactions/:id/reverse', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const context = getServiceContext(req);
    const { reversalDate, reversalReason } = req.body;

    if (!reversalReason) {
      return res.status(400).json({
        message: 'Reversal reason is required'
      });
    }

    const glTransactionService = new GlTransactionService(context);
    const result = await glTransactionService.reverseTransaction({
      transactionId: id,
      reversalDate,
      reversalReason
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error reversing transaction:', error);
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode).json({
        message: serviceError.message,
        code: serviceError.code,
        details: serviceError.details
      });
    }
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message });
    }
    next(error);
  }
});

// POST /api/v1/gl/transactions/:id/approve - Approve a transaction
router.post('/transactions/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const context = getServiceContext(req);
    const { approvalComment } = req.body;

    const glTransactionService = new GlTransactionService(context);
    const result = await glTransactionService.approveTransaction({
      transactionId: id,
      approvalComment
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error approving transaction:', error);
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode).json({
        message: serviceError.message,
        code: serviceError.code,
        details: serviceError.details
      });
    }
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message });
    }
    next(error);
  }
});

// GL REPORTING ROUTES

// GET /api/v1/gl/reports/trial-balance - Get trial balance report
router.get('/reports/trial-balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = getServiceContext(req);
    const { periodId, subsidiaryId, includeInactive, classId, departmentId, locationId } = req.query;

    if (!periodId) {
      return res.status(400).json({
        message: 'Period ID is required for trial balance'
      });
    }

    const glReportingService = new GlReportingService(context);
    const result = await glReportingService.getTrialBalance({
      periodId: periodId as string,
      subsidiaryId: subsidiaryId as string,
      includeInactive: includeInactive === 'true',
      classId: classId as string,
      departmentId: departmentId as string,
      locationId: locationId as string
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error generating trial balance:', error);
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode).json({
        message: serviceError.message,
        code: serviceError.code,
        details: serviceError.details
      });
    }
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message });
    }
    next(error);
  }
});

// GET /api/v1/gl/reports/account-activity - Get account activity
router.get('/reports/account-activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = getServiceContext(req);
    const { accountId, subsidiaryId, dateFrom, dateTo, classId, departmentId, locationId } = req.query;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    if (!accountId || !dateFrom || !dateTo) {
      return res.status(400).json({
        message: 'Account ID, date from, and date to are required'
      });
    }

    const glReportingService = new GlReportingService(context);
    const result = await glReportingService.getAccountActivity(
      {
        accountId: accountId as string,
        subsidiaryId: subsidiaryId as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        classId: classId as string,
        departmentId: departmentId as string,
        locationId: locationId as string
      },
      { page, limit }
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting account activity:', error);
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode).json({
        message: serviceError.message,
        code: serviceError.code,
        details: serviceError.details
      });
    }
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message });
    }
    next(error);
  }
});

// GET /api/v1/gl/reports/general-ledger - Get general ledger
router.get('/reports/general-ledger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = getServiceContext(req);
    const { subsidiaryId, periodId, dateFrom, dateTo, accountIds, includeAdjustments, groupBy } = req.query;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

    const glReportingService = new GlReportingService(context);
    const result = await glReportingService.getGeneralLedger(
      {
        subsidiaryId: subsidiaryId as string,
        periodId: periodId as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        accountIds: accountIds ? (accountIds as string).split(',') : undefined,
        includeAdjustments: includeAdjustments === 'true',
        groupBy: groupBy as 'account' | 'date' | 'transaction'
      },
      { page, limit }
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting general ledger:', error);
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode).json({
        message: serviceError.message,
        code: serviceError.code,
        details: serviceError.details
      });
    }
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message });
    }
    next(error);
  }
});

// GET /api/v1/gl/gl-transactions - List GL transactions
router.get('/gl-transactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = getServiceContext(req);
    
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const subsidiaryId = req.query.subsidiaryId as string;
    const periodId = req.query.periodId as string;
    const status = req.query.status as string;
    const transactionType = req.query.transactionType as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const sourceTransactionId = req.query.sourceTransactionId as string;

    const glReportingService = new GlReportingService(context);
    const result = await glReportingService.listGlTransactions(
      { page, limit },
      { subsidiaryId, periodId, status, transactionType, dateFrom, dateTo, sourceTransactionId }
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error listing GL transactions:', error);
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode).json({
        message: serviceError.message,
        code: serviceError.code,
        details: serviceError.details
      });
    }
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message });
    }
    next(error);
  }
});

// GET /api/v1/gl/gl-transactions/:id - Get GL transaction details
router.get('/gl-transactions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const context = getServiceContext(req);

    const glReportingService = new GlReportingService(context);
    const result = await glReportingService.getGlTransactionById(id);

    if (!result) {
      return res.status(404).json({
        message: `GL transaction with ID "${id}" not found`
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting GL transaction:', error);
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode).json({
        message: serviceError.message,
        code: serviceError.code,
        details: serviceError.details
      });
    }
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message });
    }
    next(error);
  }
});

// GET /api/v1/gl/gl-transactions/:id/lines - Get GL transaction lines
router.get('/gl-transactions/:id/lines', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const context = getServiceContext(req);

    const glReportingService = new GlReportingService(context);
    const result = await glReportingService.getGlTransactionLines(id);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting GL transaction lines:', error);
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode).json({
        message: serviceError.message,
        code: serviceError.code,
        details: serviceError.details
      });
    }
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message });
    }
    next(error);
  }
});

export default router;