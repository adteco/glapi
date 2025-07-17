import { createCallerFactory } from '@trpc/server';
import { appRouter, createContext } from '@glapi/trpc';
import type { Context } from '@glapi/trpc';

// Mock context for testing
export function createMockContext(overrides: Partial<Context> = {}): Context {
  return {
    req: undefined,
    res: undefined,
    user: {
      id: 'test-user-id',
      organizationId: 'test-org-id',
      email: 'test@example.com',
      role: 'user',
    },
    db: undefined,
    serviceContext: {
      organizationId: 'test-org-id',
      userId: 'test-user-id',
    },
    ...overrides,
  };
}

// Create tRPC caller for testing
export function createTestCaller(context: Context = createMockContext()) {
  const createCaller = createCallerFactory(appRouter);
  return createCaller(context);
}

// Utility for testing authenticated endpoints
export function createAuthenticatedCaller(orgId?: string, userId?: string) {
  const context = createMockContext({
    user: {
      id: userId || 'test-user-id',
      organizationId: orgId || 'test-org-id',
      email: 'test@example.com',
      role: 'user',
    },
    serviceContext: {
      organizationId: orgId || 'test-org-id',
      userId: userId || 'test-user-id',
    },
  });
  return createTestCaller(context);
}

// Utility for testing unauthenticated scenarios
export function createUnauthenticatedCaller() {
  const context: Context = {
    req: undefined,
    res: undefined,
    user: null,
    db: undefined,
    serviceContext: undefined,
  };
  return createTestCaller(context);
}

// Test helpers for common scenarios
export class TrpcTestUtils {
  /**
   * Test that an endpoint requires authentication
   */
  static async expectAuthenticationRequired(
    operation: () => Promise<any>
  ) {
    const caller = createUnauthenticatedCaller();
    
    await expect(operation()).rejects.toThrow('UNAUTHORIZED');
  }

  /**
   * Test that an endpoint requires organization context
   */
  static async expectOrganizationRequired(
    operation: (caller: ReturnType<typeof createTestCaller>) => Promise<any>
  ) {
    const caller = createTestCaller(createMockContext({ orgId: null }));
    
    await expect(operation(caller)).rejects.toThrow();
  }

  /**
   * Test successful operation with proper context
   */
  static async testWithValidContext<T>(
    operation: (caller: ReturnType<typeof createTestCaller>) => Promise<T>,
    orgId?: string
  ): Promise<T> {
    const caller = createAuthenticatedCaller(orgId);
    return await operation(caller);
  }

  /**
   * Test input validation
   */
  static async expectValidationError(
    operation: () => Promise<any>,
    expectedMessage?: string
  ) {
    try {
      await operation();
      throw new Error('Expected validation error but operation succeeded');
    } catch (error) {
      expect(error.code).toBe('BAD_REQUEST');
      if (expectedMessage) {
        expect(error.message).toContain(expectedMessage);
      }
    }
  }

  /**
   * Test that operation handles not found scenarios
   */
  static async expectNotFound(
    operation: () => Promise<any>
  ) {
    await expect(operation()).rejects.toThrow('NOT_FOUND');
  }

  /**
   * Test pagination parameters
   */
  static async testPagination<T>(
    listOperation: (page: number, limit: number) => Promise<{ data: T[]; meta: any }>,
    totalRecords: number
  ) {
    // Test first page
    const page1 = await listOperation(1, 10);
    expect(page1.data).toHaveLength(Math.min(10, totalRecords));
    expect(page1.meta.page).toBe(1);
    expect(page1.meta.totalPages).toBe(Math.ceil(totalRecords / 10));

    // Test pagination with different limit
    const page2 = await listOperation(1, 5);
    expect(page2.data).toHaveLength(Math.min(5, totalRecords));
    expect(page2.meta.limit).toBe(5);
  }

  /**
   * Test search functionality
   */
  static async testSearch<T>(
    searchOperation: (query: string) => Promise<{ data: T[] }>,
    searchTerm: string,
    expectedCount: number
  ) {
    const result = await searchOperation(searchTerm);
    expect(result.data).toHaveLength(expectedCount);
  }

  /**
   * Test sorting functionality
   */
  static async testSorting<T>(
    sortOperation: (field: string, direction: 'asc' | 'desc') => Promise<{ data: T[] }>,
    field: string,
    extractValue: (item: T) => any
  ) {
    // Test ascending sort
    const ascResult = await sortOperation(field, 'asc');
    const ascValues = ascResult.data.map(extractValue);
    const ascSorted = [...ascValues].sort();
    expect(ascValues).toEqual(ascSorted);

    // Test descending sort
    const descResult = await sortOperation(field, 'desc');
    const descValues = descResult.data.map(extractValue);
    const descSorted = [...descValues].sort().reverse();
    expect(descValues).toEqual(descSorted);
  }
}

// Mock external services for testing
export const mockServices = {
  paymentService: {
    processPayment: jest.fn(),
    validatePaymentMethod: jest.fn(),
    calculateFees: jest.fn(),
  },
  
  inventoryService: {
    checkAvailability: jest.fn(),
    reserveItems: jest.fn(),
    updateQuantities: jest.fn(),
    calculateCosts: jest.fn(),
  },
  
  accountingService: {
    createJournalEntry: jest.fn(),
    postToGeneralLedger: jest.fn(),
    calculateTax: jest.fn(),
  },
  
  notificationService: {
    sendEmail: jest.fn(),
    sendSMS: jest.fn(),
    createNotification: jest.fn(),
  }
};

// Reset all mocks
export function resetAllMocks() {
  Object.values(mockServices).forEach(service => {
    Object.values(service).forEach(mock => {
      if (jest.isMockFunction(mock)) {
        mock.mockReset();
      }
    });
  });
}

// Common test data generators
export const testData = {
  createPurchaseOrderInput: (vendorId: string) => ({
    vendorId,
    expectedDate: new Date('2024-12-31'),
    items: [
      {
        itemId: 'test-item-id',
        quantity: 10,
        unitCost: 25.50,
      }
    ],
    notes: 'Test purchase order',
  }),

  createSalesOrderInput: (customerId: string) => ({
    customerId,
    requestedDate: new Date('2024-12-31'),
    items: [
      {
        itemId: 'test-item-id',
        quantity: 5,
        unitPrice: 50.00,
      }
    ],
    notes: 'Test sales order',
  }),

  createInvoiceInput: (customerId: string, salesOrderId?: string) => ({
    customerId,
    salesOrderId,
    invoiceDate: new Date(),
    dueDate: new Date('2024-12-31'),
    items: [
      {
        itemId: 'test-item-id',
        quantity: 5,
        unitPrice: 50.00,
        description: 'Test item',
      }
    ],
    notes: 'Test invoice',
  }),

  createPaymentInput: (amount: number, invoiceIds: string[] = []) => ({
    amount,
    paymentDate: new Date(),
    paymentMethod: 'CREDIT_CARD' as const,
    reference: 'TEST-PAYMENT-001',
    invoiceIds,
    notes: 'Test payment',
  }),
};