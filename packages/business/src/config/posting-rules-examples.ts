/**
 * Example Posting Rule Configurations
 *
 * Reference implementations for common transaction types following
 * standard accounting practices and ASC 606 revenue recognition.
 *
 * @module posting-rules-examples
 */

import type { PostingRuleSetConfig } from './posting-rules-dsl.js';

// ============================================================================
// Revenue Recognition Rules (ASC 606)
// ============================================================================

/**
 * Revenue recognition posting rules for SaaS/subscription businesses
 */
export const revenueRecognitionRules: PostingRuleSetConfig = {
  metadata: {
    name: 'Revenue Recognition Rules',
    version: '1.0.0',
    description: 'ASC 606 compliant revenue recognition posting rules for subscription businesses',
    baseCurrency: 'USD',
    effectiveDate: '2024-01-01',
  },
  defaults: {
    isActive: true,
  },
  rules: [
    // -------------------------------------------------------------------------
    // Invoice Creation
    // -------------------------------------------------------------------------
    {
      id: 'INVOICE_AR_DEFERRED',
      name: 'Invoice - Debit AR, Credit Deferred Revenue',
      description: 'When invoice is created, debit AR and credit deferred revenue',
      transactionType: 'INVOICE',
      sequence: 10,
      post: [
        {
          side: 'debit',
          account: { default: 'accountsReceivable' },
          amount: { field: 'totalAmount' },
          description: {
            template: 'Invoice {{invoiceNumber}} - {{customerName}}',
          },
        },
        {
          side: 'credit',
          account: { default: 'deferredRevenue' },
          amount: { field: 'totalAmount' },
          description: {
            template: 'Deferred revenue - Invoice {{invoiceNumber}}',
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Revenue Recognition (Period-based)
    // -------------------------------------------------------------------------
    {
      id: 'REVRECOG_DEFERRED_TO_RECOGNIZED',
      name: 'Revenue Recognition - Transfer from Deferred to Recognized',
      description: 'Monthly recognition of deferred revenue based on performance obligations',
      transactionType: 'REVENUE_RECOGNITION',
      sequence: 10,
      post: [
        {
          side: 'debit',
          account: { default: 'deferredRevenue' },
          amount: { field: 'recognitionAmount' },
          description: {
            template: 'Rev rec {{period}} - {{contractNumber}}',
          },
        },
        {
          side: 'credit',
          account: { default: 'revenue' },
          amount: { field: 'recognitionAmount' },
          description: {
            template: 'Revenue recognized {{period}} - {{contractNumber}}',
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Payment Receipt
    // -------------------------------------------------------------------------
    {
      id: 'PAYMENT_CASH_AR',
      name: 'Payment Receipt - Debit Cash, Credit AR',
      description: 'When payment is received, debit cash and credit accounts receivable',
      transactionType: 'PAYMENT',
      sequence: 10,
      post: [
        {
          side: 'debit',
          account: { default: 'cash' },
          amount: { field: 'paymentAmount' },
          description: {
            template: 'Payment received - {{customerName}} - {{paymentReference}}',
          },
        },
        {
          side: 'credit',
          account: { default: 'accountsReceivable' },
          amount: { field: 'paymentAmount' },
          description: {
            template: 'AR applied - Invoice {{invoiceNumber}}',
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Refund
    // -------------------------------------------------------------------------
    {
      id: 'REFUND_FULL',
      name: 'Full Refund - Reverse AR and Deferred Revenue',
      description: 'Full refund reverses the original invoice entries',
      transactionType: 'REFUND',
      when: {
        match: { refundType: 'FULL' },
      },
      sequence: 10,
      post: [
        {
          side: 'debit',
          account: { default: 'deferredRevenue' },
          amount: { field: 'refundAmount' },
          description: {
            template: 'Refund - {{refundReference}}',
          },
        },
        {
          side: 'credit',
          account: { default: 'accountsReceivable' },
          amount: { field: 'refundAmount' },
          description: {
            template: 'AR reversal - Refund {{refundReference}}',
          },
        },
      ],
    },
  ],
};

// ============================================================================
// Order-to-Cash Rules
// ============================================================================

/**
 * Order-to-cash cycle posting rules
 */
export const orderToCashRules: PostingRuleSetConfig = {
  metadata: {
    name: 'Order-to-Cash Rules',
    version: '1.0.0',
    description: 'Standard posting rules for the order-to-cash cycle',
    baseCurrency: 'USD',
    effectiveDate: '2024-01-01',
  },
  defaults: {
    isActive: true,
  },
  rules: [
    // -------------------------------------------------------------------------
    // Sales Order (Commitment only - no GL impact until invoice)
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // Shipment / Delivery
    // -------------------------------------------------------------------------
    {
      id: 'SHIP_INVENTORY_COGS',
      name: 'Shipment - Reduce Inventory, Record COGS',
      description: 'When goods are shipped, reduce inventory and record cost of goods sold',
      transactionType: {
        code: 'SHIPMENT',
        lineType: 'PRODUCT',
      },
      sequence: 10,
      post: [
        {
          side: 'debit',
          account: { default: 'costOfGoodsSold' },
          amount: { field: 'costAmount' },
          description: {
            template: 'COGS - Shipment {{shipmentNumber}}',
          },
        },
        {
          side: 'credit',
          account: { default: 'inventory' },
          amount: { field: 'costAmount' },
          description: {
            template: 'Inventory relief - {{itemCode}}',
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Credit Memo
    // -------------------------------------------------------------------------
    {
      id: 'CREDIT_MEMO_AR',
      name: 'Credit Memo - Reduce AR',
      description: 'Credit memo reduces accounts receivable and revenue',
      transactionType: 'CREDIT_MEMO',
      sequence: 10,
      post: [
        {
          side: 'debit',
          account: { default: 'revenue' },
          amount: { field: 'creditAmount' },
          description: {
            template: 'Credit memo {{creditMemoNumber}}',
          },
        },
        {
          side: 'credit',
          account: { default: 'accountsReceivable' },
          amount: { field: 'creditAmount' },
          description: {
            template: 'AR credit - {{creditMemoNumber}}',
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Write-off
    // -------------------------------------------------------------------------
    {
      id: 'WRITEOFF_BAD_DEBT',
      name: 'Bad Debt Write-off',
      description: 'Write off uncollectible accounts receivable',
      transactionType: 'WRITE_OFF',
      sequence: 10,
      post: [
        {
          side: 'debit',
          account: '6500', // Bad Debt Expense (example account number)
          amount: { field: 'writeOffAmount' },
          description: {
            template: 'Bad debt write-off - {{customerName}}',
          },
        },
        {
          side: 'credit',
          account: { default: 'accountsReceivable' },
          amount: { field: 'writeOffAmount' },
          description: {
            template: 'AR write-off - Invoice {{invoiceNumber}}',
          },
        },
      ],
    },
  ],
};

// ============================================================================
// Procure-to-Pay Rules
// ============================================================================

/**
 * Procure-to-pay cycle posting rules
 */
export const procureToPayRules: PostingRuleSetConfig = {
  metadata: {
    name: 'Procure-to-Pay Rules',
    version: '1.0.0',
    description: 'Standard posting rules for the procure-to-pay cycle',
    baseCurrency: 'USD',
    effectiveDate: '2024-01-01',
  },
  defaults: {
    isActive: true,
  },
  rules: [
    // -------------------------------------------------------------------------
    // Purchase Order Receipt (Inventory)
    // -------------------------------------------------------------------------
    {
      id: 'PO_RECEIPT_INVENTORY',
      name: 'PO Receipt - Increase Inventory',
      description: 'When inventory is received, debit inventory and credit AP accrual',
      transactionType: {
        code: 'PO_RECEIPT',
        lineType: 'INVENTORY',
      },
      sequence: 10,
      post: [
        {
          side: 'debit',
          account: { default: 'inventory' },
          amount: { field: 'receivedAmount' },
          description: {
            template: 'Inventory receipt - PO {{poNumber}}',
          },
        },
        {
          side: 'credit',
          account: '2100', // AP Accrual (example)
          amount: { field: 'receivedAmount' },
          description: {
            template: 'AP accrual - PO {{poNumber}}',
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Vendor Bill
    // -------------------------------------------------------------------------
    {
      id: 'BILL_AP',
      name: 'Vendor Bill - Record AP',
      description: 'When vendor bill is received, transfer accrual to AP',
      transactionType: 'VENDOR_BILL',
      sequence: 10,
      post: [
        {
          side: 'debit',
          account: '2100', // AP Accrual (example)
          amount: { field: 'billAmount' },
          description: {
            template: 'AP accrual clear - Bill {{billNumber}}',
          },
        },
        {
          side: 'credit',
          account: { default: 'accountsPayable' },
          amount: { field: 'billAmount' },
          description: {
            template: 'AP recorded - Vendor {{vendorName}}',
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Bill Payment
    // -------------------------------------------------------------------------
    {
      id: 'BILL_PAYMENT',
      name: 'Bill Payment - Pay Vendor',
      description: 'When paying a vendor bill, debit AP and credit cash',
      transactionType: 'BILL_PAYMENT',
      sequence: 10,
      post: [
        {
          side: 'debit',
          account: { default: 'accountsPayable' },
          amount: { field: 'paymentAmount' },
          description: {
            template: 'AP payment - {{vendorName}}',
          },
        },
        {
          side: 'credit',
          account: { default: 'cash' },
          amount: { field: 'paymentAmount' },
          description: {
            template: 'Cash disbursement - Check {{checkNumber}}',
          },
        },
      ],
    },
  ],
};

// ============================================================================
// Multi-Currency Rules
// ============================================================================

/**
 * Foreign exchange and multi-currency posting rules
 */
export const multiCurrencyRules: PostingRuleSetConfig = {
  metadata: {
    name: 'Multi-Currency Rules',
    version: '1.0.0',
    description: 'Posting rules for foreign exchange gains/losses',
    baseCurrency: 'USD',
    effectiveDate: '2024-01-01',
  },
  defaults: {
    isActive: true,
  },
  rules: [
    // -------------------------------------------------------------------------
    // Realized FX Gain
    // -------------------------------------------------------------------------
    {
      id: 'FX_GAIN_REALIZED',
      name: 'Realized FX Gain',
      description: 'Record realized foreign exchange gain on settlement',
      transactionType: 'FX_REVALUATION',
      when: {
        expression: 'fx_gain_loss > 0',
      },
      sequence: 10,
      post: [
        {
          side: 'debit',
          account: { default: 'accountsReceivable' },
          amount: { field: 'fxGainLoss' },
          description: {
            template: 'FX gain - {{transactionCurrency}} to {{baseCurrency}}',
          },
        },
        {
          side: 'credit',
          account: { default: 'fxGainLoss' },
          amount: { field: 'fxGainLoss' },
          description: {
            template: 'Realized FX gain - {{period}}',
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Realized FX Loss
    // -------------------------------------------------------------------------
    {
      id: 'FX_LOSS_REALIZED',
      name: 'Realized FX Loss',
      description: 'Record realized foreign exchange loss on settlement',
      transactionType: 'FX_REVALUATION',
      when: {
        expression: 'fx_gain_loss < 0',
      },
      sequence: 20,
      post: [
        {
          side: 'debit',
          account: { default: 'fxGainLoss' },
          amount: {
            formula: 'ABS(fx_gain_loss)',
          },
          description: {
            template: 'Realized FX loss - {{period}}',
          },
        },
        {
          side: 'credit',
          account: { default: 'accountsReceivable' },
          amount: {
            formula: 'ABS(fx_gain_loss)',
          },
          description: {
            template: 'FX loss - {{transactionCurrency}} to {{baseCurrency}}',
          },
        },
      ],
    },
  ],
};

// ============================================================================
// Period-End Rules
// ============================================================================

/**
 * Period-end closing and adjustment rules
 */
export const periodEndRules: PostingRuleSetConfig = {
  metadata: {
    name: 'Period-End Closing Rules',
    version: '1.0.0',
    description: 'Posting rules for period-end close activities',
    baseCurrency: 'USD',
    effectiveDate: '2024-01-01',
  },
  defaults: {
    isActive: true,
  },
  rules: [
    // -------------------------------------------------------------------------
    // Depreciation
    // -------------------------------------------------------------------------
    {
      id: 'DEPRECIATION_MONTHLY',
      name: 'Monthly Depreciation',
      description: 'Record monthly depreciation expense',
      transactionType: 'DEPRECIATION',
      sequence: 10,
      post: [
        {
          side: 'debit',
          account: '6200', // Depreciation Expense
          amount: { field: 'depreciationAmount' },
          description: {
            template: 'Depreciation - {{assetClass}} - {{period}}',
          },
          dimensions: {
            department: { field: 'assetDepartment' },
          },
        },
        {
          side: 'credit',
          account: '1600', // Accumulated Depreciation
          amount: { field: 'depreciationAmount' },
          description: {
            template: 'Accum depr - {{assetNumber}}',
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Accrual Reversal
    // -------------------------------------------------------------------------
    {
      id: 'ACCRUAL_REVERSAL',
      name: 'Accrual Reversal',
      description: 'Reverse prior period accrual entries',
      transactionType: 'ACCRUAL_REVERSAL',
      sequence: 10,
      post: [
        {
          side: 'debit',
          account: { field: 'originalCreditAccount' },
          amount: { field: 'reversalAmount' },
          description: {
            template: 'Reversal - {{originalDescription}}',
          },
        },
        {
          side: 'credit',
          account: { field: 'originalDebitAccount' },
          amount: { field: 'reversalAmount' },
          description: {
            template: 'Reversal - {{originalDescription}}',
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // Retained Earnings Close
    // -------------------------------------------------------------------------
    {
      id: 'CLOSE_TO_RETAINED',
      name: 'Close Income to Retained Earnings',
      description: 'Year-end close of income summary to retained earnings',
      transactionType: 'YEAR_END_CLOSE',
      sequence: 100,
      post: [
        {
          side: 'debit',
          account: '3900', // Income Summary
          amount: { field: 'netIncome' },
          description: {
            template: 'Close income summary - FY{{fiscalYear}}',
          },
        },
        {
          side: 'credit',
          account: { default: 'retainedEarnings' },
          amount: { field: 'netIncome' },
          description: {
            template: 'Transfer to retained earnings - FY{{fiscalYear}}',
          },
        },
      ],
    },
  ],
};

// ============================================================================
// Exports
// ============================================================================

/**
 * All standard posting rule sets
 */
export const standardPostingRuleSets = {
  revenueRecognition: revenueRecognitionRules,
  orderToCash: orderToCashRules,
  procureToPay: procureToPayRules,
  multiCurrency: multiCurrencyRules,
  periodEnd: periodEndRules,
};

/**
 * Get all rules as a flat array
 */
export function getAllStandardRules(): PostingRuleSetConfig[] {
  return Object.values(standardPostingRuleSets);
}
