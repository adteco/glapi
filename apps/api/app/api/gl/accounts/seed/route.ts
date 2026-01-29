import { NextRequest, NextResponse } from 'next/server';
import { AccountService } from '@glapi/api-service';
import { getServiceContext } from '../../../utils/auth';
import { isServiceError } from '../../../utils/errors';

const defaultAccounts = [
  // ASSETS (10000-19999) - SUMMARY ACCOUNT
  { accountNumber: "10000", accountName: "Assets", accountCategory: "Asset" as const, description: "Total assets" },
  { accountNumber: "10100", accountName: "Cash", accountCategory: "Asset" as const, description: "Cash and cash equivalents" },
  { accountNumber: "11000", accountName: "Bank", accountCategory: "Asset" as const, description: "Bank accounts and deposits" },
  { accountNumber: "12000", accountName: "Accounts Receivable", accountCategory: "Asset" as const, description: "Money owed by customers" },
  { accountNumber: "13000", accountName: "Other Current Assets", accountCategory: "Asset" as const, description: "Other short-term assets" },
  { accountNumber: "14000", accountName: "Inventory", accountCategory: "Asset" as const, description: "Goods held for sale" },
  { accountNumber: "15000", accountName: "Prepaid Expenses", accountCategory: "Asset" as const, description: "Expenses paid in advance" },
  { accountNumber: "16000", accountName: "Fixed Assets", accountCategory: "Asset" as const, description: "Long-term physical assets" },
  { accountNumber: "17000", accountName: "Accumulated Depreciation", accountCategory: "Asset" as const, description: "Total depreciation of fixed assets" },
  { accountNumber: "18000", accountName: "Intangible Assets", accountCategory: "Asset" as const, description: "Non-physical assets" },
  { accountNumber: "19000", accountName: "Other Assets", accountCategory: "Asset" as const, description: "Miscellaneous assets" },

  // LIABILITIES (20000-29999) - SUMMARY ACCOUNT
  { accountNumber: "20000", accountName: "Liabilities", accountCategory: "Liability" as const, description: "Total liabilities" },
  { accountNumber: "20100", accountName: "Accounts Payable", accountCategory: "Liability" as const, description: "Money owed to suppliers" },
  { accountNumber: "21000", accountName: "Credit Card", accountCategory: "Liability" as const, description: "Credit card balances" },
  { accountNumber: "22000", accountName: "Short-term Loans", accountCategory: "Liability" as const, description: "Loans due within one year" },
  { accountNumber: "23000", accountName: "Accrued Liabilities", accountCategory: "Liability" as const, description: "Expenses incurred but not yet paid" },
  { accountNumber: "24000", accountName: "Deferred Revenue", accountCategory: "Liability" as const, description: "Revenue received but not yet earned" },
  { accountNumber: "25000", accountName: "Long-term Debt", accountCategory: "Liability" as const, description: "Loans due after one year" },
  { accountNumber: "26000", accountName: "Other Current Liabilities", accountCategory: "Liability" as const, description: "Other short-term obligations" },
  { accountNumber: "27000", accountName: "Payroll Liabilities", accountCategory: "Liability" as const, description: "Payroll taxes and benefits owed" },
  { accountNumber: "28000", accountName: "Sales Tax Payable", accountCategory: "Liability" as const, description: "Sales tax collected but not yet remitted" },
  { accountNumber: "29000", accountName: "Other Liabilities", accountCategory: "Liability" as const, description: "Miscellaneous liabilities" },

  // EQUITY (30000-39999) - SUMMARY ACCOUNT
  { accountNumber: "30000", accountName: "Equity", accountCategory: "Equity" as const, description: "Total equity" },
  { accountNumber: "30100", accountName: "Owner's Equity", accountCategory: "Equity" as const, description: "Owner's investment in the business" },
  { accountNumber: "31000", accountName: "Common Stock", accountCategory: "Equity" as const, description: "Value of common shares" },
  { accountNumber: "32000", accountName: "Retained Earnings", accountCategory: "Equity" as const, description: "Accumulated profits" },
  { accountNumber: "33000", accountName: "Dividends", accountCategory: "Equity" as const, description: "Distributions to shareholders" },
  { accountNumber: "34000", accountName: "Owner's Draw", accountCategory: "Equity" as const, description: "Owner withdrawals" },
  { accountNumber: "35000", accountName: "Opening Balance Equity", accountCategory: "Equity" as const, description: "Initial equity balance" },

  // REVENUE (40000-49999) - SUMMARY ACCOUNT
  { accountNumber: "40000", accountName: "Revenue", accountCategory: "Revenue" as const, description: "Total revenue" },
  { accountNumber: "40100", accountName: "Sales Revenue", accountCategory: "Revenue" as const, description: "Revenue from sales" },
  { accountNumber: "41000", accountName: "Service Revenue", accountCategory: "Revenue" as const, description: "Revenue from services" },
  { accountNumber: "42000", accountName: "Interest Income", accountCategory: "Revenue" as const, description: "Interest earned" },
  { accountNumber: "43000", accountName: "Other Income", accountCategory: "Revenue" as const, description: "Miscellaneous income" },
  { accountNumber: "44000", accountName: "Rental Income", accountCategory: "Revenue" as const, description: "Income from property rentals" },
  { accountNumber: "45000", accountName: "Commission Income", accountCategory: "Revenue" as const, description: "Commissions earned" },
  { accountNumber: "46000", accountName: "Investment Income", accountCategory: "Revenue" as const, description: "Returns on investments" },
  { accountNumber: "47000", accountName: "Gain on Asset Sale", accountCategory: "Revenue" as const, description: "Profit from selling assets" },
  { accountNumber: "48000", accountName: "Royalty Income", accountCategory: "Revenue" as const, description: "Royalties received" },
  { accountNumber: "49000", accountName: "Miscellaneous Revenue", accountCategory: "Revenue" as const, description: "Other revenue sources" },

  // COST OF GOODS SOLD (50000-59999) - SUMMARY ACCOUNT
  { accountNumber: "50000", accountName: "Cost of Goods Sold", accountCategory: "COGS" as const, description: "Total cost of goods sold" },
  { accountNumber: "50100", accountName: "Product Costs", accountCategory: "COGS" as const, description: "Direct cost of products" },
  { accountNumber: "51000", accountName: "Materials Cost", accountCategory: "COGS" as const, description: "Cost of raw materials" },
  { accountNumber: "52000", accountName: "Labor Cost", accountCategory: "COGS" as const, description: "Direct labor costs" },
  { accountNumber: "53000", accountName: "Subcontractor Cost", accountCategory: "COGS" as const, description: "Cost of subcontracted work" },
  { accountNumber: "54000", accountName: "Freight and Delivery", accountCategory: "COGS" as const, description: "Shipping costs for goods sold" },
  { accountNumber: "55000", accountName: "Manufacturing Overhead", accountCategory: "COGS" as const, description: "Indirect production costs" },
  { accountNumber: "56000", accountName: "Purchase Discounts", accountCategory: "COGS" as const, description: "Discounts on purchases" },
  { accountNumber: "57000", accountName: "Inventory Adjustments", accountCategory: "COGS" as const, description: "Changes in inventory value" },
  { accountNumber: "58000", accountName: "Other COGS", accountCategory: "COGS" as const, description: "Miscellaneous cost of goods sold" },

  // EXPENSES (60000-79999) - SUMMARY ACCOUNT
  { accountNumber: "60000", accountName: "Operating Expenses", accountCategory: "Expense" as const, description: "Total operating expenses" },
  { accountNumber: "60100", accountName: "Salaries and Wages", accountCategory: "Expense" as const, description: "Employee compensation" },
  { accountNumber: "61000", accountName: "Rent Expense", accountCategory: "Expense" as const, description: "Office and facility rent" },
  { accountNumber: "62000", accountName: "Utilities", accountCategory: "Expense" as const, description: "Electricity, water, gas" },
  { accountNumber: "63000", accountName: "Insurance", accountCategory: "Expense" as const, description: "Business insurance premiums" },
  { accountNumber: "64000", accountName: "Office Supplies", accountCategory: "Expense" as const, description: "Office materials and supplies" },
  { accountNumber: "65000", accountName: "Marketing and Advertising", accountCategory: "Expense" as const, description: "Promotional expenses" },
  { accountNumber: "66000", accountName: "Professional Fees", accountCategory: "Expense" as const, description: "Legal and accounting fees" },
  { accountNumber: "67000", accountName: "Travel Expense", accountCategory: "Expense" as const, description: "Business travel costs" },
  { accountNumber: "68000", accountName: "Meals and Entertainment", accountCategory: "Expense" as const, description: "Business meals and entertainment" },
  { accountNumber: "69000", accountName: "Depreciation Expense", accountCategory: "Expense" as const, description: "Asset depreciation" },
  { accountNumber: "70000", accountName: "Repairs and Maintenance", accountCategory: "Expense" as const, description: "Equipment and facility maintenance" },
  { accountNumber: "71000", accountName: "Telephone and Internet", accountCategory: "Expense" as const, description: "Communication expenses" },
  { accountNumber: "72000", accountName: "Vehicle Expenses", accountCategory: "Expense" as const, description: "Vehicle operation costs" },
  { accountNumber: "73000", accountName: "Bank Fees", accountCategory: "Expense" as const, description: "Banking charges and fees" },
  { accountNumber: "74000", accountName: "Interest Expense", accountCategory: "Expense" as const, description: "Interest on loans" },
  { accountNumber: "75000", accountName: "Training and Development", accountCategory: "Expense" as const, description: "Employee training costs" },
  { accountNumber: "76000", accountName: "Software and Subscriptions", accountCategory: "Expense" as const, description: "Software licenses and subscriptions" },
  { accountNumber: "77000", accountName: "Payroll Taxes", accountCategory: "Expense" as const, description: "Employer payroll taxes" },
  { accountNumber: "78000", accountName: "Employee Benefits", accountCategory: "Expense" as const, description: "Health insurance, retirement" },
  { accountNumber: "79000", accountName: "Miscellaneous Expense", accountCategory: "Expense" as const, description: "Other operating expenses" },

  // OTHER EXPENSES (80000-89999)
  { accountNumber: "80000", accountName: "Other Expenses", accountCategory: "Expense" as const, description: "Non-operating expenses" },
  { accountNumber: "81000", accountName: "Bad Debt Expense", accountCategory: "Expense" as const, description: "Uncollectible accounts" },
  { accountNumber: "82000", accountName: "Charitable Contributions", accountCategory: "Expense" as const, description: "Donations to charity" },
  { accountNumber: "83000", accountName: "Fines and Penalties", accountCategory: "Expense" as const, description: "Legal fines and penalties" },
  { accountNumber: "84000", accountName: "Loss on Asset Sale", accountCategory: "Expense" as const, description: "Loss from selling assets" },
  { accountNumber: "85000", accountName: "Income Tax Expense", accountCategory: "Expense" as const, description: "Corporate income taxes" },
  { accountNumber: "86000", accountName: "Amortization Expense", accountCategory: "Expense" as const, description: "Intangible asset amortization" }
];

// POST /api/gl/accounts/seed - Seed GL accounts with default chart of accounts
export async function POST(_request: NextRequest) {
  try {
    const context = await getServiceContext();
    const accountService = new AccountService(context);
    
    const result = await accountService.seedDefaultAccounts(defaultAccounts);
    
    return NextResponse.json({
      message: `Seeded ${result.created} accounts successfully${result.failed > 0 ? `, ${result.failed} failed or already existed` : ''}`,
      ...result
    }, { status: 201 });
  } catch (error) {
    console.error('Error seeding GL accounts:', error);
    
    if (isServiceError(error)) {
      return NextResponse.json(
        {
          message: error.message,
          code: error.code,
          details: error.details
        },
        { status: error.statusCode }
      );
    }
    
    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}