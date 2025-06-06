import { NextRequest, NextResponse } from 'next/server';
import { accountRepository } from '@glapi/database';
import { getServiceContext } from '../../../utils/auth';

const defaultAccounts = [
  // ASSETS (10000-19999) - SUMMARY ACCOUNT
  { account_number: "10000", account_name: "Assets", account_category: "Asset" as const, description: "Total assets" },
  { account_number: "10100", account_name: "Cash", account_category: "Asset" as const, description: "Cash and cash equivalents" },
  { account_number: "11000", account_name: "Bank", account_category: "Asset" as const, description: "Bank accounts and deposits" },
  { account_number: "12000", account_name: "Accounts Receivable", account_category: "Asset" as const, description: "Money owed by customers" },
  { account_number: "13000", account_name: "Other Current Assets", account_category: "Asset" as const, description: "Other short-term assets" },
  { account_number: "14000", account_name: "Inventory", account_category: "Asset" as const, description: "Goods held for sale" },
  { account_number: "15000", account_name: "Prepaid Expenses", account_category: "Asset" as const, description: "Expenses paid in advance" },
  { account_number: "16000", account_name: "Fixed Assets", account_category: "Asset" as const, description: "Long-term physical assets" },
  { account_number: "17000", account_name: "Accumulated Depreciation", account_category: "Asset" as const, description: "Total depreciation of fixed assets" },
  { account_number: "18000", account_name: "Intangible Assets", account_category: "Asset" as const, description: "Non-physical assets" },
  { account_number: "19000", account_name: "Other Assets", account_category: "Asset" as const, description: "Miscellaneous assets" },

  // LIABILITIES (20000-29999) - SUMMARY ACCOUNT
  { account_number: "20000", account_name: "Liabilities", account_category: "Liability" as const, description: "Total liabilities" },
  { account_number: "20100", account_name: "Accounts Payable", account_category: "Liability" as const, description: "Money owed to suppliers" },
  { account_number: "21000", account_name: "Credit Card", account_category: "Liability" as const, description: "Credit card balances" },
  { account_number: "22000", account_name: "Short-term Loans", account_category: "Liability" as const, description: "Loans due within one year" },
  { account_number: "23000", account_name: "Accrued Liabilities", account_category: "Liability" as const, description: "Expenses incurred but not yet paid" },
  { account_number: "24000", account_name: "Deferred Revenue", account_category: "Liability" as const, description: "Revenue received but not yet earned" },
  { account_number: "25000", account_name: "Long-term Debt", account_category: "Liability" as const, description: "Loans due after one year" },
  { account_number: "26000", account_name: "Other Current Liabilities", account_category: "Liability" as const, description: "Other short-term obligations" },
  { account_number: "27000", account_name: "Payroll Liabilities", account_category: "Liability" as const, description: "Payroll taxes and benefits owed" },
  { account_number: "28000", account_name: "Sales Tax Payable", account_category: "Liability" as const, description: "Sales tax collected but not yet remitted" },
  { account_number: "29000", account_name: "Other Liabilities", account_category: "Liability" as const, description: "Miscellaneous liabilities" },

  // EQUITY (30000-39999) - SUMMARY ACCOUNT
  { account_number: "30000", account_name: "Equity", account_category: "Equity" as const, description: "Total equity" },
  { account_number: "30100", account_name: "Owner's Equity", account_category: "Equity" as const, description: "Owner's investment in the business" },
  { account_number: "31000", account_name: "Common Stock", account_category: "Equity" as const, description: "Value of common shares" },
  { account_number: "32000", account_name: "Retained Earnings", account_category: "Equity" as const, description: "Accumulated profits" },
  { account_number: "33000", account_name: "Dividends", account_category: "Equity" as const, description: "Distributions to shareholders" },
  { account_number: "34000", account_name: "Owner's Draw", account_category: "Equity" as const, description: "Owner withdrawals" },
  { account_number: "35000", account_name: "Opening Balance Equity", account_category: "Equity" as const, description: "Initial equity balance" },

  // REVENUE (40000-49999) - SUMMARY ACCOUNT
  { account_number: "40000", account_name: "Revenue", account_category: "Revenue" as const, description: "Total revenue" },
  { account_number: "40100", account_name: "Sales Revenue", account_category: "Revenue" as const, description: "Revenue from sales" },
  { account_number: "41000", account_name: "Service Revenue", account_category: "Revenue" as const, description: "Revenue from services" },
  { account_number: "42000", account_name: "Interest Income", account_category: "Revenue" as const, description: "Interest earned" },
  { account_number: "43000", account_name: "Other Income", account_category: "Revenue" as const, description: "Miscellaneous income" },
  { account_number: "44000", account_name: "Rental Income", account_category: "Revenue" as const, description: "Income from property rentals" },
  { account_number: "45000", account_name: "Commission Income", account_category: "Revenue" as const, description: "Commissions earned" },
  { account_number: "46000", account_name: "Investment Income", account_category: "Revenue" as const, description: "Returns on investments" },
  { account_number: "47000", account_name: "Gain on Asset Sale", account_category: "Revenue" as const, description: "Profit from selling assets" },
  { account_number: "48000", account_name: "Royalty Income", account_category: "Revenue" as const, description: "Royalties received" },
  { account_number: "49000", account_name: "Miscellaneous Revenue", account_category: "Revenue" as const, description: "Other revenue sources" },

  // COST OF GOODS SOLD (50000-59999) - SUMMARY ACCOUNT
  { account_number: "50000", account_name: "Cost of Goods Sold", account_category: "COGS" as const, description: "Total cost of goods sold" },
  { account_number: "50100", account_name: "Product Costs", account_category: "COGS" as const, description: "Direct cost of products" },
  { account_number: "51000", account_name: "Materials Cost", account_category: "COGS" as const, description: "Cost of raw materials" },
  { account_number: "52000", account_name: "Labor Cost", account_category: "COGS" as const, description: "Direct labor costs" },
  { account_number: "53000", account_name: "Subcontractor Cost", account_category: "COGS" as const, description: "Cost of subcontracted work" },
  { account_number: "54000", account_name: "Freight and Delivery", account_category: "COGS" as const, description: "Shipping costs for goods sold" },
  { account_number: "55000", account_name: "Manufacturing Overhead", account_category: "COGS" as const, description: "Indirect production costs" },
  { account_number: "56000", account_name: "Purchase Discounts", account_category: "COGS" as const, description: "Discounts on purchases" },
  { account_number: "57000", account_name: "Inventory Adjustments", account_category: "COGS" as const, description: "Changes in inventory value" },
  { account_number: "58000", account_name: "Other COGS", account_category: "COGS" as const, description: "Miscellaneous cost of goods sold" },

  // EXPENSES (60000-79999) - SUMMARY ACCOUNT
  { account_number: "60000", account_name: "Operating Expenses", account_category: "Expense" as const, description: "Total operating expenses" },
  { account_number: "60100", account_name: "Salaries and Wages", account_category: "Expense" as const, description: "Employee compensation" },
  { account_number: "61000", account_name: "Rent Expense", account_category: "Expense" as const, description: "Office and facility rent" },
  { account_number: "62000", account_name: "Utilities", account_category: "Expense" as const, description: "Electricity, water, gas" },
  { account_number: "63000", account_name: "Insurance", account_category: "Expense" as const, description: "Business insurance premiums" },
  { account_number: "64000", account_name: "Office Supplies", account_category: "Expense" as const, description: "Office materials and supplies" },
  { account_number: "65000", account_name: "Marketing and Advertising", account_category: "Expense" as const, description: "Promotional expenses" },
  { account_number: "66000", account_name: "Professional Fees", account_category: "Expense" as const, description: "Legal and accounting fees" },
  { account_number: "67000", account_name: "Travel Expense", account_category: "Expense" as const, description: "Business travel costs" },
  { account_number: "68000", account_name: "Meals and Entertainment", account_category: "Expense" as const, description: "Business meals and entertainment" },
  { account_number: "69000", account_name: "Depreciation Expense", account_category: "Expense" as const, description: "Asset depreciation" },
  { account_number: "70000", account_name: "Repairs and Maintenance", account_category: "Expense" as const, description: "Equipment and facility maintenance" },
  { account_number: "71000", account_name: "Telephone and Internet", account_category: "Expense" as const, description: "Communication expenses" },
  { account_number: "72000", account_name: "Vehicle Expenses", account_category: "Expense" as const, description: "Vehicle operation costs" },
  { account_number: "73000", account_name: "Bank Fees", account_category: "Expense" as const, description: "Banking charges and fees" },
  { account_number: "74000", account_name: "Interest Expense", account_category: "Expense" as const, description: "Interest on loans" },
  { account_number: "75000", account_name: "Training and Development", account_category: "Expense" as const, description: "Employee training costs" },
  { account_number: "76000", account_name: "Software and Subscriptions", account_category: "Expense" as const, description: "Software licenses and subscriptions" },
  { account_number: "77000", account_name: "Payroll Taxes", account_category: "Expense" as const, description: "Employer payroll taxes" },
  { account_number: "78000", account_name: "Employee Benefits", account_category: "Expense" as const, description: "Health insurance, retirement" },
  { account_number: "79000", account_name: "Miscellaneous Expense", account_category: "Expense" as const, description: "Other operating expenses" },

  // OTHER EXPENSES (80000-89999)
  { account_number: "80000", account_name: "Other Expenses", account_category: "Expense" as const, description: "Non-operating expenses" },
  { account_number: "81000", account_name: "Bad Debt Expense", account_category: "Expense" as const, description: "Uncollectible accounts" },
  { account_number: "82000", account_name: "Charitable Contributions", account_category: "Expense" as const, description: "Donations to charity" },
  { account_number: "83000", account_name: "Fines and Penalties", account_category: "Expense" as const, description: "Legal fines and penalties" },
  { account_number: "84000", account_name: "Loss on Asset Sale", account_category: "Expense" as const, description: "Loss from selling assets" },
  { account_number: "85000", account_name: "Income Tax Expense", account_category: "Expense" as const, description: "Corporate income taxes" },
  { account_number: "86000", account_name: "Amortization Expense", account_category: "Expense" as const, description: "Intangible asset amortization" }
];

// POST /api/gl/accounts/seed - Seed GL accounts with default chart of accounts
export async function POST(request: NextRequest) {
  try {
    const context = getServiceContext();
    
    const results = await Promise.allSettled(
      defaultAccounts.map(account => 
        accountRepository.createAccount({
          ...account,
          organization_id: context.organizationId
        })
      )
    );
    
    const created = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    return NextResponse.json({
      message: `Seeded ${created} accounts successfully${failed > 0 ? `, ${failed} failed or already existed` : ''}`,
      created,
      failed,
      total: defaultAccounts.length
    }, { status: 201 });
  } catch (error) {
    console.error('Error seeding GL accounts:', error);
    
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