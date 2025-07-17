import { testDb } from '../setup';
import { 
  organizations,
  entities,
  items, 
  warehouses, 
  accounts,
  unitsOfMeasure,
  itemCategories,
  businessTransactions,
  businessTransactionLines,
  transactionTypes,
  bankAccounts
} from '@glapi/database';
import { 
  createOrganizationData,
  createVendorData,
  createCustomerData,
  createItemData,
  createWarehouseData,
  createBankAccountData,
  createPurchaseOrderData,
  createSalesOrderData,
  createInvoiceData
} from '../factories';

// Database seeding utilities
export class TestDbUtils {
  /**
   * Create a complete test organization with basic master data
   */
  static async createTestOrganization() {
    // Create organization
    const orgData = createOrganizationData();
    const [org] = await testDb.insert(organizations).values(orgData).returning();

    // Create basic accounts
    const accountsData = [
      { 
        organizationId: org.id,
        accountNumber: '10000',
        accountName: 'Assets',
        accountCategory: 'Asset' as const,
        isActive: true
      },
      {
        organizationId: org.id,
        accountNumber: '11000',
        accountName: 'Cash',
        accountCategory: 'Asset' as const,
        isActive: true
      },
      {
        organizationId: org.id,
        accountNumber: '12000',
        accountName: 'Inventory',
        accountCategory: 'Asset' as const,
        isActive: true
      },
      {
        organizationId: org.id,
        accountNumber: '40000',
        accountName: 'Revenue',
        accountCategory: 'Revenue' as const,
        isActive: true
      },
      {
        organizationId: org.id,
        accountNumber: '50000',
        accountName: 'Cost of Goods Sold',
        accountCategory: 'COGS' as const,
        isActive: true
      }
    ];

    const createdAccounts = await testDb.insert(accounts).values(accountsData).returning();

    // Create unit of measure
    const uomData = {
      organizationId: org.id,
      code: 'EA',
      name: 'Each',
      abbreviation: 'ea',
      baseConversionFactor: 1,
      decimalPlaces: 0,
      isActive: true
    };
    const [uom] = await testDb.insert(unitsOfMeasure).values(uomData).returning();

    // Create item category
    const categoryData = {
      organizationId: org.id,
      code: 'GEN',
      name: 'General',
      level: 0,
      path: 'General',
      isActive: true
    };
    const [category] = await testDb.insert(itemCategories).values(categoryData).returning();

    return {
      organization: org,
      accounts: createdAccounts,
      unitOfMeasure: uom,
      category
    };
  }

  /**
   * Create a test vendor for an organization
   */
  static async createTestVendor(orgId: string) {
    const vendorData = createVendorData({ orgId });
    // Create entity first, then add vendor-specific data
    const entityData = {
      id: vendorData.id,
      organizationId: orgId,
      entityType: 'VENDOR' as const,
      name: vendorData.companyName,
      isActive: vendorData.isActive,
    };
    const [entity] = await testDb.insert(entities).values(entityData).returning();
    return { ...entity, ...vendorData };
  }

  /**
   * Create a test customer for an organization
   */
  static async createTestCustomer(orgId: string) {
    const customerData = createCustomerData({ orgId });
    // Create entity first, then add customer-specific data
    const entityData = {
      id: customerData.id,
      organizationId: orgId,
      entityType: 'CUSTOMER' as const,
      name: customerData.companyName,
      isActive: customerData.isActive,
    };
    const [entity] = await testDb.insert(entities).values(entityData).returning();
    return { ...entity, ...customerData };
  }

  /**
   * Create a test item for an organization
   */
  static async createTestItem(orgId: string, unitOfMeasureId: string) {
    const itemData = createItemData({ 
      orgId, 
      overrides: { unitOfMeasureId } 
    });
    const [item] = await testDb.insert(items).values(itemData).returning();
    return item;
  }

  /**
   * Create a test warehouse for an organization
   */
  static async createTestWarehouse(orgId: string) {
    const warehouseData = createWarehouseData({ orgId });
    const [warehouse] = await testDb.insert(warehouses).values(warehouseData).returning();
    return warehouse;
  }

  /**
   * Create a test bank account for an organization
   */
  static async createTestBankAccount(orgId: string) {
    const bankAccountData = createBankAccountData({ orgId });
    const [bankAccount] = await testDb.insert(bankAccounts).values(bankAccountData).returning();
    return bankAccount;
  }

  /**
   * Ensure a transaction type exists
   */
  static async ensureTransactionType(typeCode: string) {
    const existingType = await testDb.select().from(transactionTypes).where({ typeCode }).limit(1);
    if (existingType.length > 0) {
      return existingType[0];
    }
    
    const transactionTypeData = {
      typeCode,
      typeName: typeCode.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      typeCategory: typeCode.includes('PURCHASE') ? 'PURCHASE' : 'SALES',
      generatesGl: true,
      requiresApproval: false,
      canBeReversed: true,
      isActive: true,
      sortOrder: 0,
    };
    const [transactionType] = await testDb.insert(transactionTypes).values(transactionTypeData).returning();
    return transactionType;
  }

  /**
   * Create a test transaction (generic - can be purchase order, sales order, etc.)
   */
  static async createTestTransaction(
    orgId: string, 
    entityId: string, 
    transactionTypeCode: 'PURCHASE_ORDER' | 'SALES_ORDER' | 'ESTIMATE' | 'INVOICE',
    entityType: 'VENDOR' | 'CUSTOMER'
  ) {
    // First ensure we have the transaction type
    const transactionType = await this.ensureTransactionType(transactionTypeCode);
    
    const transactionData = {
      transactionNumber: `${transactionTypeCode.substring(0, 2)}-${Math.random().toString(36).substring(7).toUpperCase()}`,
      transactionTypeId: transactionType.id,
      subsidiaryId: orgId, // Using orgId as subsidiaryId for now
      entityId,
      entityType,
      transactionDate: new Date().toISOString().split('T')[0],
      status: 'DRAFT',
      subtotalAmount: '1000.00',
      totalAmount: '1000.00',
      baseTotalAmount: '1000.00',
      currencyCode: 'USD',
    };
    const [transaction] = await testDb.insert(businessTransactions).values(transactionData).returning();
    return transaction;
  }

  /**
   * Create a test purchase order
   */
  static async createTestPurchaseOrder(orgId: string, vendorId: string) {
    return await this.createTestTransaction(orgId, vendorId, 'PURCHASE_ORDER', 'VENDOR');
  }

  /**
   * Create a test sales order
   */
  static async createTestSalesOrder(orgId: string, customerId: string) {
    return await this.createTestTransaction(orgId, customerId, 'SALES_ORDER', 'CUSTOMER');
  }

  /**
   * Create a test invoice
   */
  static async createTestInvoice(orgId: string, customerId: string, salesOrderId?: string) {
    const invoice = await this.createTestTransaction(orgId, customerId, 'INVOICE', 'CUSTOMER');
    if (salesOrderId) {
      // Update with reference to sales order
      const [updated] = await testDb.update(businessTransactions)
        .set({ parentTransactionId: salesOrderId })
        .where({ id: invoice.id })
        .returning();
      return updated;
    }
    return invoice;
  }

  /**
   * Create a complete test dataset for order-to-cash testing
   */
  static async createCompleteTestData() {
    const { organization, accounts, unitOfMeasure, category } = await this.createTestOrganization();
    
    const vendor = await this.createTestVendor(organization.id);
    const customer = await this.createTestCustomer(organization.id);
    const item = await this.createTestItem(organization.id, unitOfMeasure.id);
    const warehouse = await this.createTestWarehouse(organization.id);
    const bankAccount = await this.createTestBankAccount(organization.id);

    return {
      organization,
      accounts,
      unitOfMeasure,
      category,
      vendor,
      customer,
      item,
      warehouse,
      bankAccount
    };
  }

  /**
   * Get count of records in a table
   */
  static async getRecordCount(tableName: string): Promise<number> {
    const result = await testDb.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
    return parseInt(result.rows[0].count as string);
  }

  /**
   * Check if a record exists
   */
  static async recordExists(tableName: string, id: string): Promise<boolean> {
    const result = await testDb.execute(`SELECT 1 FROM ${tableName} WHERE id = $1`, [id]);
    return result.rows.length > 0;
  }

  /**
   * Clean all data from database
   */
  static async cleanDatabase() {
    const tablesToTruncate = [
      'business_transaction_lines',
      'business_transactions',
      'transaction_types',
      'entities',
      'inventory_transactions',
      'bank_transactions', 
      'journal_entry_lines',
      'journal_entries',
      'purchase_order_lines',
      'item_receipt_lines',
      'sales_order_lines',
      'item_fulfillment_lines',
      'invoice_lines',
      'payment_applications',
      'vendor_payments',
      'customer_payments',
      'vendor_bills',
      'invoices',
      'item_fulfillments',
      'sales_orders',
      'item_receipts',
      'purchase_orders',
      'inventory_records',
      'bank_accounts',
      'price_list_items',
      'warehouse_price_lists',
      'price_lists',
      'units_of_measure',
      'item_categories',
      'items',
      'customers',
      'vendors',
      'locations',
      'departments',
      'classes',
      'subsidiaries',
      'warehouses',
      'accounts',
      'organizations',
    ];

    for (const table of tablesToTruncate) {
      try {
        await testDb.execute(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
      } catch (error) {
        // Table might not exist yet, that's OK
        if (!error.message.includes('does not exist')) {
          console.warn(`Warning: Could not truncate table ${table}:`, error.message);
        }
      }
    }
  }
}