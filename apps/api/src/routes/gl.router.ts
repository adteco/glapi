import express, { Router, Request, Response } from 'express';
import { accountRepository } from '@glapi/database';

// Extend Request to include organizationContext
interface AuthenticatedRequest extends Request {
  organizationContext?: {
    organizationId: string;
    userId: string;
    stytchOrganizationId: string;
  };
}

const router: Router = express.Router();

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

export default router;