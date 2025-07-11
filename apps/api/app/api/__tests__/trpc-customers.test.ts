import { createTRPCMsw } from 'msw-trpc';
import { AppRouter } from '@glapi/trpc';
import { setupServer } from 'msw/node';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';

// Mock the tRPC router
const trpc = createTRPCMsw<AppRouter>();

// Setup MSW server
const server = setupServer();

// Create tRPC client for testing
const createTestClient = () => {
  return createTRPCClient<AppRouter>({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: 'http://localhost:3000/api/trpc',
      }),
    ],
  });
};

describe('tRPC Customer Routes', () => {
  let client: ReturnType<typeof createTestClient>;

  beforeAll(() => {
    server.listen();
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    client = createTestClient();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('customers.list', () => {
    it('should list customers with pagination', async () => {
      const mockCustomers = {
        data: [
          {
            id: 'cust-1',
            companyName: 'Test Company 1',
            customerId: 'CUST-001',
            contactEmail: 'test1@example.com',
            status: 'active' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'cust-2',
            companyName: 'Test Company 2',
            customerId: 'CUST-002',
            contactEmail: 'test2@example.com',
            status: 'active' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 2,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.customers.list.query(() => {
          return mockCustomers;
        })
      );

      const result = await client.customers.list.query({
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockCustomers);
    });

    it('should filter customers by status', async () => {
      const mockActiveCustomers = {
        data: [
          {
            id: 'cust-1',
            companyName: 'Active Company',
            customerId: 'CUST-001',
            contactEmail: 'active@example.com',
            status: 'active' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.customers.list.query((req) => {
          expect(req.status).toBe('active');
          return mockActiveCustomers;
        })
      );

      const result = await client.customers.list.query({
        status: 'active',
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockActiveCustomers);
    });

    it('should search customers by company name', async () => {
      const mockSearchResults = {
        data: [
          {
            id: 'cust-1',
            companyName: 'Acme Corporation',
            customerId: 'CUST-001',
            contactEmail: 'contact@acme.com',
            status: 'active' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.customers.list.query((req) => {
          expect(req.search).toBe('Acme');
          return mockSearchResults;
        })
      );

      const result = await client.customers.list.query({
        search: 'Acme',
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockSearchResults);
    });
  });

  describe('customers.create', () => {
    it('should create a new customer', async () => {
      const customerData = {
        companyName: 'New Company',
        customerId: 'CUST-003',
        contactEmail: 'new@example.com',
        contactPhone: '555-1234',
        status: 'active' as const,
      };

      const createdCustomer = {
        id: 'cust-3',
        ...customerData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      server.use(
        trpc.customers.create.mutation((req) => {
          expect(req).toEqual(customerData);
          return createdCustomer;
        })
      );

      const result = await client.customers.create.mutate(customerData);

      expect(result).toEqual(createdCustomer);
    });

    it('should create customer with billing address', async () => {
      const customerData = {
        companyName: 'Address Company',
        customerId: 'CUST-004',
        contactEmail: 'address@example.com',
        status: 'active' as const,
        billingAddress: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          postalCode: '12345',
          country: 'USA',
        },
      };

      const createdCustomer = {
        id: 'cust-4',
        ...customerData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      server.use(
        trpc.customers.create.mutation((req) => {
          expect(req).toEqual(customerData);
          return createdCustomer;
        })
      );

      const result = await client.customers.create.mutate(customerData);

      expect(result).toEqual(createdCustomer);
    });

    it('should handle validation errors', async () => {
      const invalidData = {
        companyName: '', // Invalid: empty company name
        status: 'active' as const,
      };

      server.use(
        trpc.customers.create.mutation(() => {
          throw new Error('Company name is required');
        })
      );

      await expect(
        client.customers.create.mutate(invalidData)
      ).rejects.toThrow('Company name is required');
    });
  });

  describe('customers.getById', () => {
    it('should get customer by ID', async () => {
      const mockCustomer = {
        id: 'cust-1',
        companyName: 'Test Company',
        customerId: 'CUST-001',
        contactEmail: 'test@example.com',
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      server.use(
        trpc.customers.getById.query((req) => {
          expect(req).toBe('cust-1');
          return mockCustomer;
        })
      );

      const result = await client.customers.getById.query('cust-1');

      expect(result).toEqual(mockCustomer);
    });

    it('should handle customer not found', async () => {
      server.use(
        trpc.customers.getById.query(() => {
          throw new Error('Customer not found');
        })
      );

      await expect(
        client.customers.getById.query('invalid-id')
      ).rejects.toThrow('Customer not found');
    });
  });

  describe('customers.update', () => {
    it('should update customer successfully', async () => {
      const updateData = {
        companyName: 'Updated Company Name',
        contactEmail: 'updated@example.com',
        contactPhone: '555-9999',
      };

      const updatedCustomer = {
        id: 'cust-1',
        customerId: 'CUST-001',
        ...updateData,
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      server.use(
        trpc.customers.update.mutation((req) => {
          expect(req.id).toBe('cust-1');
          expect(req.data).toEqual(updateData);
          return updatedCustomer;
        })
      );

      const result = await client.customers.update.mutate({
        id: 'cust-1',
        data: updateData,
      });

      expect(result).toEqual(updatedCustomer);
    });

    it('should update customer with partial data', async () => {
      const updateData = {
        contactEmail: 'newemail@example.com',
      };

      const updatedCustomer = {
        id: 'cust-1',
        companyName: 'Existing Company',
        customerId: 'CUST-001',
        contactEmail: 'newemail@example.com',
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      server.use(
        trpc.customers.update.mutation((req) => {
          expect(req.id).toBe('cust-1');
          expect(req.data).toEqual(updateData);
          return updatedCustomer;
        })
      );

      const result = await client.customers.update.mutate({
        id: 'cust-1',
        data: updateData,
      });

      expect(result).toEqual(updatedCustomer);
    });

    it('should update customer address', async () => {
      const updateData = {
        billingAddress: {
          street: '456 Oak Ave',
          city: 'New City',
          state: 'NY',
          postalCode: '54321',
          country: 'USA',
        },
      };

      const updatedCustomer = {
        id: 'cust-1',
        companyName: 'Test Company',
        customerId: 'CUST-001',
        contactEmail: 'test@example.com',
        status: 'active' as const,
        billingAddress: updateData.billingAddress,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      server.use(
        trpc.customers.update.mutation((req) => {
          expect(req.id).toBe('cust-1');
          expect(req.data).toEqual(updateData);
          return updatedCustomer;
        })
      );

      const result = await client.customers.update.mutate({
        id: 'cust-1',
        data: updateData,
      });

      expect(result).toEqual(updatedCustomer);
    });

    it('should handle update validation errors', async () => {
      const invalidData = {
        contactEmail: 'invalid-email', // Invalid email format
      };

      server.use(
        trpc.customers.update.mutation(() => {
          throw new Error('Invalid email format');
        })
      );

      await expect(
        client.customers.update.mutate({
          id: 'cust-1',
          data: invalidData,
        })
      ).rejects.toThrow('Invalid email format');
    });

    it('should handle customer not found during update', async () => {
      const updateData = {
        companyName: 'Updated Name',
      };

      server.use(
        trpc.customers.update.mutation(() => {
          throw new Error('Customer not found');
        })
      );

      await expect(
        client.customers.update.mutate({
          id: 'invalid-id',
          data: updateData,
        })
      ).rejects.toThrow('Customer not found');
    });
  });

  describe('customers.delete', () => {
    it('should delete customer successfully', async () => {
      server.use(
        trpc.customers.delete.mutation((req) => {
          expect(req).toBe('cust-1');
          return { success: true };
        })
      );

      const result = await client.customers.delete.mutate('cust-1');

      expect(result).toEqual({ success: true });
    });

    it('should handle customer not found during delete', async () => {
      server.use(
        trpc.customers.delete.mutation(() => {
          throw new Error('Customer not found');
        })
      );

      await expect(
        client.customers.delete.mutate('invalid-id')
      ).rejects.toThrow('Customer not found');
    });
  });

  describe('customers.getChildren', () => {
    it('should get child customers', async () => {
      const mockChildren = [
        {
          id: 'child-1',
          companyName: 'Child Company 1',
          customerId: 'CHILD-001',
          parentCustomerId: 'parent-1',
          status: 'active' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'child-2',
          companyName: 'Child Company 2',
          customerId: 'CHILD-002',
          parentCustomerId: 'parent-1',
          status: 'active' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      server.use(
        trpc.customers.getChildren.query((req) => {
          expect(req).toBe('parent-1');
          return mockChildren;
        })
      );

      const result = await client.customers.getChildren.query('parent-1');

      expect(result).toEqual(mockChildren);
    });

    it('should return empty array for customer with no children', async () => {
      server.use(
        trpc.customers.getChildren.query(() => {
          return [];
        })
      );

      const result = await client.customers.getChildren.query('no-children');

      expect(result).toEqual([]);
    });
  });
});