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

describe('tRPC List Entity Routes', () => {
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

  describe('Accounts (GL Accounts)', () => {
    const mockAccount = {
      id: 'acc-1',
      accountNumber: '1000',
      accountName: 'Cash',
      accountType: 'ASSET' as const,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should list GL accounts', async () => {
      const mockAccounts = {
        data: [mockAccount],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.accounts.list.query(() => mockAccounts)
      );

      const result = await client.accounts.list.query({
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockAccounts);
    });

    it('should create GL account', async () => {
      const accountData = {
        accountNumber: '1001',
        accountName: 'Checking Account',
        accountType: 'ASSET' as const,
        isActive: true,
      };

      const createdAccount = { id: 'acc-2', ...accountData, createdAt: new Date(), updatedAt: new Date() };

      server.use(
        trpc.accounts.create.mutation((req) => {
          expect(req).toEqual(accountData);
          return createdAccount;
        })
      );

      const result = await client.accounts.create.mutate(accountData);
      expect(result).toEqual(createdAccount);
    });

    it('should update GL account', async () => {
      const updateData = { accountName: 'Updated Cash Account' };
      const updatedAccount = { ...mockAccount, ...updateData, updatedAt: new Date() };

      server.use(
        trpc.accounts.update.mutation((req) => {
          expect(req.id).toBe('acc-1');
          expect(req.data).toEqual(updateData);
          return updatedAccount;
        })
      );

      const result = await client.accounts.update.mutate({
        id: 'acc-1',
        data: updateData,
      });

      expect(result).toEqual(updatedAccount);
    });

    it('should delete GL account', async () => {
      server.use(
        trpc.accounts.delete.mutation((req) => {
          expect(req).toBe('acc-1');
          return { success: true };
        })
      );

      const result = await client.accounts.delete.mutate('acc-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('Classes', () => {
    const mockClass = {
      id: 'class-1',
      classCode: 'DEPT-001',
      className: 'Marketing',
      description: 'Marketing department',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should list classes', async () => {
      const mockClasses = {
        data: [mockClass],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.classes.list.query(() => mockClasses)
      );

      const result = await client.classes.list.query({
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockClasses);
    });

    it('should create class', async () => {
      const classData = {
        classCode: 'DEPT-002',
        className: 'Sales',
        description: 'Sales department',
        isActive: true,
      };

      const createdClass = { id: 'class-2', ...classData, createdAt: new Date(), updatedAt: new Date() };

      server.use(
        trpc.classes.create.mutation((req) => {
          expect(req).toEqual(classData);
          return createdClass;
        })
      );

      const result = await client.classes.create.mutate(classData);
      expect(result).toEqual(createdClass);
    });

    it('should update class', async () => {
      const updateData = { className: 'Updated Marketing' };
      const updatedClass = { ...mockClass, ...updateData, updatedAt: new Date() };

      server.use(
        trpc.classes.update.mutation((req) => {
          expect(req.id).toBe('class-1');
          expect(req.data).toEqual(updateData);
          return updatedClass;
        })
      );

      const result = await client.classes.update.mutate({
        id: 'class-1',
        data: updateData,
      });

      expect(result).toEqual(updatedClass);
    });

    it('should delete class', async () => {
      server.use(
        trpc.classes.delete.mutation((req) => {
          expect(req).toBe('class-1');
          return { success: true };
        })
      );

      const result = await client.classes.delete.mutate('class-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('Departments', () => {
    const mockDepartment = {
      id: 'dept-1',
      departmentCode: 'ENG-001',
      departmentName: 'Engineering',
      description: 'Engineering department',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should list departments', async () => {
      const mockDepartments = {
        data: [mockDepartment],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.departments.list.query(() => mockDepartments)
      );

      const result = await client.departments.list.query({
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockDepartments);
    });

    it('should create department', async () => {
      const departmentData = {
        departmentCode: 'HR-001',
        departmentName: 'Human Resources',
        description: 'HR department',
        isActive: true,
      };

      const createdDepartment = { id: 'dept-2', ...departmentData, createdAt: new Date(), updatedAt: new Date() };

      server.use(
        trpc.departments.create.mutation((req) => {
          expect(req).toEqual(departmentData);
          return createdDepartment;
        })
      );

      const result = await client.departments.create.mutate(departmentData);
      expect(result).toEqual(createdDepartment);
    });

    it('should update department', async () => {
      const updateData = { departmentName: 'Updated Engineering' };
      const updatedDepartment = { ...mockDepartment, ...updateData, updatedAt: new Date() };

      server.use(
        trpc.departments.update.mutation((req) => {
          expect(req.id).toBe('dept-1');
          expect(req.data).toEqual(updateData);
          return updatedDepartment;
        })
      );

      const result = await client.departments.update.mutate({
        id: 'dept-1',
        data: updateData,
      });

      expect(result).toEqual(updatedDepartment);
    });

    it('should delete department', async () => {
      server.use(
        trpc.departments.delete.mutation((req) => {
          expect(req).toBe('dept-1');
          return { success: true };
        })
      );

      const result = await client.departments.delete.mutate('dept-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('Locations', () => {
    const mockLocation = {
      id: 'loc-1',
      locationCode: 'NYC-001',
      locationName: 'New York Office',
      address: {
        street: '123 Broadway',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'USA',
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should list locations', async () => {
      const mockLocations = {
        data: [mockLocation],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.locations.list.query(() => mockLocations)
      );

      const result = await client.locations.list.query({
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockLocations);
    });

    it('should create location', async () => {
      const locationData = {
        locationCode: 'LA-001',
        locationName: 'Los Angeles Office',
        address: {
          street: '456 Sunset Blvd',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90210',
          country: 'USA',
        },
        isActive: true,
      };

      const createdLocation = { id: 'loc-2', ...locationData, createdAt: new Date(), updatedAt: new Date() };

      server.use(
        trpc.locations.create.mutation((req) => {
          expect(req).toEqual(locationData);
          return createdLocation;
        })
      );

      const result = await client.locations.create.mutate(locationData);
      expect(result).toEqual(createdLocation);
    });

    it('should update location', async () => {
      const updateData = { locationName: 'Updated NYC Office' };
      const updatedLocation = { ...mockLocation, ...updateData, updatedAt: new Date() };

      server.use(
        trpc.locations.update.mutation((req) => {
          expect(req.id).toBe('loc-1');
          expect(req.data).toEqual(updateData);
          return updatedLocation;
        })
      );

      const result = await client.locations.update.mutate({
        id: 'loc-1',
        data: updateData,
      });

      expect(result).toEqual(updatedLocation);
    });

    it('should delete location', async () => {
      server.use(
        trpc.locations.delete.mutation((req) => {
          expect(req).toBe('loc-1');
          return { success: true };
        })
      );

      const result = await client.locations.delete.mutate('loc-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('Subsidiaries', () => {
    const mockSubsidiary = {
      id: 'sub-1',
      subsidiaryCode: 'SUB-001',
      subsidiaryName: 'ACME Corp',
      taxId: '12-3456789',
      address: {
        street: '789 Main St',
        city: 'Anytown',
        state: 'TX',
        postalCode: '75001',
        country: 'USA',
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should list subsidiaries', async () => {
      const mockSubsidiaries = {
        data: [mockSubsidiary],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.subsidiaries.list.query(() => mockSubsidiaries)
      );

      const result = await client.subsidiaries.list.query({
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockSubsidiaries);
    });

    it('should create subsidiary', async () => {
      const subsidiaryData = {
        subsidiaryCode: 'SUB-002',
        subsidiaryName: 'Widget Inc',
        taxId: '98-7654321',
        address: {
          street: '321 Oak Ave',
          city: 'Somewhere',
          state: 'FL',
          postalCode: '33101',
          country: 'USA',
        },
        isActive: true,
      };

      const createdSubsidiary = { id: 'sub-2', ...subsidiaryData, createdAt: new Date(), updatedAt: new Date() };

      server.use(
        trpc.subsidiaries.create.mutation((req) => {
          expect(req).toEqual(subsidiaryData);
          return createdSubsidiary;
        })
      );

      const result = await client.subsidiaries.create.mutate(subsidiaryData);
      expect(result).toEqual(createdSubsidiary);
    });

    it('should update subsidiary', async () => {
      const updateData = { subsidiaryName: 'Updated ACME Corp' };
      const updatedSubsidiary = { ...mockSubsidiary, ...updateData, updatedAt: new Date() };

      server.use(
        trpc.subsidiaries.update.mutation((req) => {
          expect(req.id).toBe('sub-1');
          expect(req.data).toEqual(updateData);
          return updatedSubsidiary;
        })
      );

      const result = await client.subsidiaries.update.mutate({
        id: 'sub-1',
        data: updateData,
      });

      expect(result).toEqual(updatedSubsidiary);
    });

    it('should delete subsidiary', async () => {
      server.use(
        trpc.subsidiaries.delete.mutation((req) => {
          expect(req).toBe('sub-1');
          return { success: true };
        })
      );

      const result = await client.subsidiaries.delete.mutate('sub-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('Items', () => {
    const mockItem = {
      id: 'item-1',
      itemCode: 'ITEM-001',
      name: 'Test Item',
      itemType: 'INVENTORY_ITEM' as const,
      unitOfMeasureId: 'uom-1',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should list items', async () => {
      const mockItems = {
        data: [mockItem],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.items.list.query(() => mockItems)
      );

      const result = await client.items.list.query({
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockItems);
    });

    it('should create item', async () => {
      const itemData = {
        itemCode: 'ITEM-002',
        name: 'New Item',
        itemType: 'SERVICE' as const,
        unitOfMeasureId: 'uom-2',
        isActive: true,
      };

      const createdItem = { id: 'item-2', ...itemData, createdAt: new Date(), updatedAt: new Date() };

      server.use(
        trpc.items.create.mutation((req) => {
          expect(req).toEqual(itemData);
          return createdItem;
        })
      );

      const result = await client.items.create.mutate(itemData);
      expect(result).toEqual(createdItem);
    });

    it('should update item', async () => {
      const updateData = { name: 'Updated Test Item' };
      const updatedItem = { ...mockItem, ...updateData, updatedAt: new Date() };

      server.use(
        trpc.items.update.mutation((req) => {
          expect(req.id).toBe('item-1');
          expect(req.data).toEqual(updateData);
          return updatedItem;
        })
      );

      const result = await client.items.update.mutate({
        id: 'item-1',
        data: updateData,
      });

      expect(result).toEqual(updatedItem);
    });

    it('should delete item', async () => {
      server.use(
        trpc.items.delete.mutation((req) => {
          expect(req).toBe('item-1');
          return { success: true };
        })
      );

      const result = await client.items.delete.mutate('item-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('Cross-entity filtering and search', () => {
    it('should filter items by category', async () => {
      const mockFilteredItems = {
        data: [
          {
            id: 'item-1',
            itemCode: 'ITEM-001',
            name: 'Electronics Item',
            itemType: 'INVENTORY_ITEM' as const,
            categoryId: 'cat-electronics',
            unitOfMeasureId: 'uom-1',
            isActive: true,
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
        trpc.items.list.query((req) => {
          expect(req.categoryId).toBe('cat-electronics');
          return mockFilteredItems;
        })
      );

      const result = await client.items.list.query({
        categoryId: 'cat-electronics',
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockFilteredItems);
    });

    it('should search across multiple fields', async () => {
      const mockSearchResults = {
        data: [
          {
            id: 'item-1',
            itemCode: 'WIDGET-001',
            name: 'Blue Widget',
            itemType: 'INVENTORY_ITEM' as const,
            description: 'A blue colored widget',
            unitOfMeasureId: 'uom-1',
            isActive: true,
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
        trpc.items.list.query((req) => {
          expect(req.search).toBe('blue widget');
          return mockSearchResults;
        })
      );

      const result = await client.items.list.query({
        search: 'blue widget',
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockSearchResults);
    });
  });
});