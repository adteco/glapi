/**
 * GL Integration Adapter
 * Handles integration with external General Ledger systems
 */

import { 
  journalEntryBatches,
  ExternalSystems,
  type RevenueJournalEntry
} from '@glapi/database';
import { eq } from 'drizzle-orm';

export interface GLPostingResult {
  success: boolean;
  externalBatchId?: string;
  postedEntries?: number;
  error?: string;
  details?: any;
}

export interface GLBalance {
  account: string;
  accountName: string;
  balance: number;
  currency?: string;
  asOfDate?: Date;
}

export interface ExternalJournalEntry {
  entryId: string;
  entryDate: string;
  description: string;
  lines: ExternalJournalLine[];
  reference?: string;
  currency?: string;
  metadata?: Record<string, any>;
}

export interface ExternalJournalLine {
  account: string;
  debitAmount?: number;
  creditAmount?: number;
  description?: string;
  dimensions?: Record<string, string>;
}

export interface GLSystemConfig {
  systemType: string;
  apiUrl?: string;
  apiKey?: string;
  companyId?: string;
  options?: Record<string, any>;
}

/**
 * Base GL Adapter class
 */
export abstract class BaseGLAdapter {
  abstract postEntries(entries: ExternalJournalEntry[]): Promise<GLPostingResult>;
  abstract getBalances(accounts: string[], asOfDate: Date): Promise<GLBalance[]>;
  abstract validateConnection(): Promise<boolean>;
}

/**
 * Main GL Integration Adapter
 */
export class GLIntegrationAdapter {
  private adapter: BaseGLAdapter | null = null;
  private config: GLSystemConfig | null = null;

  constructor(
    private db: any,
    private organizationId: string
  ) {
    this.initializeAdapter();
  }

  /**
   * Initialize the appropriate GL adapter based on configuration
   */
  private async initializeAdapter(): Promise<void> {
    // Get GL system configuration for the organization
    this.config = await this.getGLSystemConfig();
    
    if (!this.config) {
      console.warn('No GL system configured for organization');
      return;
    }

    // Initialize the appropriate adapter
    switch (this.config.systemType) {
      case ExternalSystems.QUICKBOOKS:
        this.adapter = new QuickBooksAdapter(this.config);
        break;
      case ExternalSystems.NETSUITE:
        this.adapter = new NetSuiteAdapter(this.config);
        break;
      case ExternalSystems.SAP:
        this.adapter = new SAPAdapter(this.config);
        break;
      default:
        this.adapter = new MockGLAdapter(this.config);
    }
  }

  /**
   * Post journal entries to external GL system
   */
  async postJournalEntries(
    entries: RevenueJournalEntry[],
    batchId: string
  ): Promise<GLPostingResult> {
    if (!this.adapter) {
      return {
        success: false,
        error: 'No GL system configured'
      };
    }

    try {
      // Transform internal entries to external format
      const externalEntries = this.transformToExternalFormat(entries);
      
      // Validate entries before posting
      const validationErrors = this.validateEntries(externalEntries);
      if (validationErrors.length > 0) {
        return {
          success: false,
          error: `Validation failed: ${validationErrors.join(', ')}`
        };
      }

      // Post to external system
      const result = await this.adapter.postEntries(externalEntries);
      
      // Update batch with external reference
      if (result.success && result.externalBatchId) {
        await this.updateBatchExternalReference(batchId, result.externalBatchId);
      }

      return result;

    } catch (error) {
      return {
        success: false,
        error: `GL posting failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Get GL balances for reconciliation
   */
  async getGLBalances(
    startDate: Date,
    endDate: Date,
    accounts?: string[]
  ): Promise<GLBalance[]> {
    if (!this.adapter) {
      return [];
    }

    try {
      // Get relevant accounts if not specified
      if (!accounts) {
        accounts = await this.getRevenueAccounts();
      }

      // Fetch balances from external system
      const balances = await this.adapter.getBalances(accounts, endDate);
      
      return balances;

    } catch (error) {
      console.error('Failed to fetch GL balances:', error);
      return [];
    }
  }

  /**
   * Transform internal journal entries to external format
   */
  private transformToExternalFormat(entries: RevenueJournalEntry[]): ExternalJournalEntry[] {
    const groupedEntries: Map<string, ExternalJournalEntry> = new Map();

    for (const entry of entries) {
      const key = `${entry.entryDate}_${entry.batchId}`;
      
      if (!groupedEntries.has(key)) {
        groupedEntries.set(key, {
          entryId: entry.id,
          entryDate: entry.entryDate,
          description: `Revenue Recognition - ${entry.entryDate}`,
          lines: [],
          reference: entry.batchId,
          metadata: {
            source: 'GLAPI_606Ledger',
            batchId: entry.batchId
          }
        });
      }

      const externalEntry = groupedEntries.get(key)!;

      // Add debit line
      if (entry.deferredRevenueAmount && parseFloat(entry.deferredRevenueAmount) > 0) {
        externalEntry.lines.push({
          account: entry.debitAccount,
          debitAmount: parseFloat(entry.deferredRevenueAmount),
          description: entry.description,
          dimensions: this.extractDimensions(entry)
        });
      }

      // Add credit line
      if (entry.recognizedRevenueAmount && parseFloat(entry.recognizedRevenueAmount) > 0) {
        externalEntry.lines.push({
          account: entry.creditAccount,
          creditAmount: parseFloat(entry.recognizedRevenueAmount),
          description: entry.description,
          dimensions: this.extractDimensions(entry)
        });
      }
    }

    return Array.from(groupedEntries.values());
  }

  /**
   * Extract dimensions from journal entry
   */
  private extractDimensions(entry: RevenueJournalEntry): Record<string, string> {
    const dimensions: Record<string, string> = {};

    if (entry.subsidiaryId) dimensions.subsidiary = entry.subsidiaryId;
    if (entry.departmentId) dimensions.department = entry.departmentId;
    if (entry.locationId) dimensions.location = entry.locationId;
    if (entry.classId) dimensions.class = entry.classId;
    if (entry.customerId) dimensions.customer = entry.customerId;
    if (entry.itemId) dimensions.item = entry.itemId;

    return dimensions;
  }

  /**
   * Validate entries before posting
   */
  private validateEntries(entries: ExternalJournalEntry[]): string[] {
    const errors: string[] = [];

    for (const entry of entries) {
      // Check if entry has lines
      if (entry.lines.length === 0) {
        errors.push(`Entry ${entry.entryId} has no lines`);
      }

      // Check if entry balances
      let totalDebits = 0;
      let totalCredits = 0;

      for (const line of entry.lines) {
        totalDebits += line.debitAmount || 0;
        totalCredits += line.creditAmount || 0;
      }

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        errors.push(`Entry ${entry.entryId} does not balance: Debits=${totalDebits}, Credits=${totalCredits}`);
      }
    }

    return errors;
  }

  /**
   * Update batch with external reference
   */
  private async updateBatchExternalReference(
    batchId: string,
    externalBatchId: string
  ): Promise<void> {
    await this.db
      .update(journalEntryBatches)
      .set({
        externalBatchId,
        externalSystemName: this.config?.systemType,
        externalPostStatus: 'posted',
        externalPostDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(journalEntryBatches.id, batchId));
  }

  /**
   * Get GL system configuration
   */
  private async getGLSystemConfig(): Promise<GLSystemConfig | null> {
    // In a real implementation, this would fetch from a configuration table
    // For now, returning a mock configuration
    return {
      systemType: 'mock',
      apiUrl: 'https://api.mockgl.com',
      apiKey: 'mock-api-key',
      companyId: 'company-123'
    };
  }

  /**
   * Get revenue accounts for reconciliation
   */
  private async getRevenueAccounts(): Promise<string[]> {
    // In a real implementation, this would fetch from GL mappings
    return ['4000', '4100', '4200']; // Sample revenue accounts
  }
}

/**
 * Mock GL Adapter for testing
 */
class MockGLAdapter extends BaseGLAdapter {
  constructor(private config: GLSystemConfig) {
    super();
  }

  async postEntries(entries: ExternalJournalEntry[]): Promise<GLPostingResult> {
    // Simulate posting delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      externalBatchId: `MOCK-${Date.now()}`,
      postedEntries: entries.length,
      details: {
        message: 'Mock posting successful',
        entries: entries.length
      }
    };
  }

  async getBalances(accounts: string[], asOfDate: Date): Promise<GLBalance[]> {
    // Return mock balances
    return accounts.map(account => ({
      account,
      accountName: `Account ${account}`,
      balance: Math.random() * 100000,
      asOfDate
    }));
  }

  async validateConnection(): Promise<boolean> {
    return true;
  }
}

/**
 * QuickBooks Adapter
 */
class QuickBooksAdapter extends BaseGLAdapter {
  constructor(private config: GLSystemConfig) {
    super();
  }

  async postEntries(entries: ExternalJournalEntry[]): Promise<GLPostingResult> {
    // Implementation would use QuickBooks API
    // This is a placeholder
    return {
      success: false,
      error: 'QuickBooks integration not implemented'
    };
  }

  async getBalances(accounts: string[], asOfDate: Date): Promise<GLBalance[]> {
    // Implementation would use QuickBooks API
    return [];
  }

  async validateConnection(): Promise<boolean> {
    // Test QuickBooks API connection
    return false;
  }
}

/**
 * NetSuite Adapter
 */
class NetSuiteAdapter extends BaseGLAdapter {
  constructor(private config: GLSystemConfig) {
    super();
  }

  async postEntries(entries: ExternalJournalEntry[]): Promise<GLPostingResult> {
    // Implementation would use NetSuite API/SuiteScript
    return {
      success: false,
      error: 'NetSuite integration not implemented'
    };
  }

  async getBalances(accounts: string[], asOfDate: Date): Promise<GLBalance[]> {
    // Implementation would use NetSuite API
    return [];
  }

  async validateConnection(): Promise<boolean> {
    // Test NetSuite API connection
    return false;
  }
}

/**
 * SAP Adapter
 */
class SAPAdapter extends BaseGLAdapter {
  constructor(private config: GLSystemConfig) {
    super();
  }

  async postEntries(entries: ExternalJournalEntry[]): Promise<GLPostingResult> {
    // Implementation would use SAP API
    return {
      success: false,
      error: 'SAP integration not implemented'
    };
  }

  async getBalances(accounts: string[], asOfDate: Date): Promise<GLBalance[]> {
    // Implementation would use SAP API
    return [];
  }

  async validateConnection(): Promise<boolean> {
    // Test SAP API connection
    return false;
  }
}