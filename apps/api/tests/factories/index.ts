import { v4 as uuidv4 } from 'uuid';
import type { 
  Organization, 
  Vendor, 
  Customer, 
  Item, 
  Warehouse,
  BankAccount,
  PurchaseOrder,
  SalesOrder,
  Invoice
} from '../../lib/db/schema';

// Base factory interface
interface FactoryOptions<T> {
  overrides?: Partial<T>;
  orgId?: string;
}

// Organization factory
export function createOrganizationData(options: FactoryOptions<Organization> = {}) {
  return {
    id: uuidv4(),
    name: 'Test Organization',
    slug: 'test-org',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...options.overrides,
  };
}

// Vendor factory
export function createVendorData(options: FactoryOptions<Vendor> = {}) {
  const orgId = options.orgId || uuidv4();
  return {
    id: uuidv4(),
    organizationId: orgId,
    vendorId: 'VEN-001',
    companyName: 'Test Vendor Inc',
    contactFirstName: 'John',
    contactLastName: 'Doe',
    contactEmail: 'john@testvendor.com',
    contactPhone: '555-0123',
    website: 'https://testvendor.com',
    taxId: '12-3456789',
    paymentTerms: 'Net 30',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...options.overrides,
  };
}

// Customer factory
export function createCustomerData(options: FactoryOptions<Customer> = {}) {
  const orgId = options.orgId || uuidv4();
  return {
    id: uuidv4(),
    organizationId: orgId,
    customerId: 'CUS-001',
    companyName: 'Test Customer LLC',
    contactFirstName: 'Jane',
    contactLastName: 'Smith',
    contactEmail: 'jane@testcustomer.com',
    contactPhone: '555-0456',
    website: 'https://testcustomer.com',
    taxId: '98-7654321',
    paymentTerms: 'Net 30',
    creditLimit: 10000,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...options.overrides,
  };
}

// Item factory
export function createItemData(options: FactoryOptions<Item> = {}) {
  const orgId = options.orgId || uuidv4();
  return {
    id: uuidv4(),
    organizationId: orgId,
    itemCode: 'ITEM-001',
    name: 'Test Item',
    description: 'A test item for unit testing',
    itemType: 'INVENTORY_ITEM' as const,
    unitOfMeasureId: uuidv4(),
    defaultPrice: 100.00,
    defaultCost: 60.00,
    isTaxable: true,
    isActive: true,
    isPurchasable: true,
    isSaleable: true,
    trackQuantity: true,
    trackLotNumbers: false,
    trackSerialNumbers: false,
    isParent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...options.overrides,
  };
}

// Warehouse factory
export function createWarehouseData(options: FactoryOptions<Warehouse> = {}) {
  const orgId = options.orgId || uuidv4();
  return {
    id: uuidv4(),
    organizationId: orgId,
    warehouseId: 'WH-001',
    name: 'Main Warehouse',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...options.overrides,
  };
}

// Bank Account factory
export function createBankAccountData(options: FactoryOptions<BankAccount> = {}) {
  const orgId = options.orgId || uuidv4();
  return {
    id: uuidv4(),
    organizationId: orgId,
    accountName: 'Test Checking Account',
    accountNumber: '****1234',
    bankName: 'Test Bank',
    routingNumber: '123456789',
    accountType: 'CHECKING' as const,
    currentBalance: 10000.00,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...options.overrides,
  };
}

// Purchase Order factory
export function createPurchaseOrderData(options: FactoryOptions<PurchaseOrder> = {}) {
  const orgId = options.orgId || uuidv4();
  return {
    id: uuidv4(),
    organizationId: orgId,
    purchaseOrderNumber: 'PO-001',
    vendorId: uuidv4(),
    status: 'DRAFT' as const,
    orderDate: new Date(),
    expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    subtotal: 1000.00,
    taxAmount: 80.00,
    totalAmount: 1080.00,
    notes: 'Test purchase order',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...options.overrides,
  };
}

// Sales Order factory
export function createSalesOrderData(options: FactoryOptions<SalesOrder> = {}) {
  const orgId = options.orgId || uuidv4();
  return {
    id: uuidv4(),
    organizationId: orgId,
    salesOrderNumber: 'SO-001',
    customerId: uuidv4(),
    status: 'DRAFT' as const,
    orderDate: new Date(),
    requestedDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    subtotal: 1500.00,
    taxAmount: 120.00,
    totalAmount: 1620.00,
    notes: 'Test sales order',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...options.overrides,
  };
}

// Invoice factory
export function createInvoiceData(options: FactoryOptions<Invoice> = {}) {
  const orgId = options.orgId || uuidv4();
  return {
    id: uuidv4(),
    organizationId: orgId,
    invoiceNumber: 'INV-001',
    customerId: uuidv4(),
    salesOrderId: uuidv4(),
    status: 'DRAFT' as const,
    invoiceDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    subtotal: 1500.00,
    taxAmount: 120.00,
    totalAmount: 1620.00,
    paidAmount: 0.00,
    balanceAmount: 1620.00,
    notes: 'Test invoice',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...options.overrides,
  };
}

// Factory utilities
export function createTestOrganization() {
  return createOrganizationData({
    overrides: {
      name: `Test Org ${Math.random().toString(36).substring(7)}`,
      slug: `test-org-${Math.random().toString(36).substring(7)}`,
    }
  });
}

export function createTestVendor(orgId: string) {
  return createVendorData({
    orgId,
    overrides: {
      vendorId: `VEN-${Math.random().toString(36).substring(7).toUpperCase()}`,
      companyName: `Test Vendor ${Math.random().toString(36).substring(7)}`,
    }
  });
}

export function createTestCustomer(orgId: string) {
  return createCustomerData({
    orgId,
    overrides: {
      customerId: `CUS-${Math.random().toString(36).substring(7).toUpperCase()}`,
      companyName: `Test Customer ${Math.random().toString(36).substring(7)}`,
    }
  });
}

export function createTestItem(orgId: string) {
  return createItemData({
    orgId,
    overrides: {
      itemCode: `ITEM-${Math.random().toString(36).substring(7).toUpperCase()}`,
      name: `Test Item ${Math.random().toString(36).substring(7)}`,
    }
  });
}