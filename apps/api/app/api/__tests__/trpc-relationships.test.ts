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

describe('tRPC Relationship Entity Routes', () => {
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

  describe('Employees', () => {
    const mockEmployee = {
      id: 'emp-1',
      employeeCode: 'EMP-001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@company.com',
      phone: '555-1234',
      departmentId: 'dept-1',
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should list employees', async () => {
      const mockEmployees = {
        data: [mockEmployee],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.employees.list.query(() => mockEmployees)
      );

      const result = await client.employees.list.query({
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockEmployees);
    });

    it('should filter employees by department', async () => {
      const mockFilteredEmployees = {
        data: [mockEmployee],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.employees.list.query((req) => {
          expect(req.departmentId).toBe('dept-1');
          return mockFilteredEmployees;
        })
      );

      const result = await client.employees.list.query({
        departmentId: 'dept-1',
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockFilteredEmployees);
    });

    it('should create employee', async () => {
      const employeeData = {
        employeeCode: 'EMP-002',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@company.com',
        phone: '555-5678',
        departmentId: 'dept-2',
        status: 'active' as const,
      };

      const createdEmployee = { id: 'emp-2', ...employeeData, createdAt: new Date(), updatedAt: new Date() };

      server.use(
        trpc.employees.create.mutation((req) => {
          expect(req).toEqual(employeeData);
          return createdEmployee;
        })
      );

      const result = await client.employees.create.mutate(employeeData);
      expect(result).toEqual(createdEmployee);
    });

    it('should update employee', async () => {
      const updateData = { 
        firstName: 'Jonathan',
        phone: '555-9999' 
      };
      const updatedEmployee = { ...mockEmployee, ...updateData, updatedAt: new Date() };

      server.use(
        trpc.employees.update.mutation((req) => {
          expect(req.id).toBe('emp-1');
          expect(req.data).toEqual(updateData);
          return updatedEmployee;
        })
      );

      const result = await client.employees.update.mutate({
        id: 'emp-1',
        data: updateData,
      });

      expect(result).toEqual(updatedEmployee);
    });

    it('should delete employee', async () => {
      server.use(
        trpc.employees.delete.mutation((req) => {
          expect(req).toBe('emp-1');
          return { success: true };
        })
      );

      const result = await client.employees.delete.mutate('emp-1');
      expect(result).toEqual({ success: true });
    });

    it('should get employee by ID', async () => {
      server.use(
        trpc.employees.getById.query((req) => {
          expect(req).toBe('emp-1');
          return mockEmployee;
        })
      );

      const result = await client.employees.getById.query('emp-1');
      expect(result).toEqual(mockEmployee);
    });
  });

  describe('Vendors', () => {
    const mockVendor = {
      id: 'vendor-1',
      companyName: 'ABC Supply Co',
      vendorCode: 'VENDOR-001',
      contactEmail: 'orders@abcsupply.com',
      contactPhone: '555-0123',
      billingAddress: {
        street: '123 Supplier St',
        city: 'Supply City',
        state: 'TX',
        postalCode: '75001',
        country: 'USA',
      },
      paymentTerms: 'NET_30',
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should list vendors', async () => {
      const mockVendors = {
        data: [mockVendor],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.vendors.list.query(() => mockVendors)
      );

      const result = await client.vendors.list.query({
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockVendors);
    });

    it('should filter vendors by status', async () => {
      const mockActiveVendors = {
        data: [mockVendor],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.vendors.list.query((req) => {
          expect(req.status).toBe('active');
          return mockActiveVendors;
        })
      );

      const result = await client.vendors.list.query({
        status: 'active',
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockActiveVendors);
    });

    it('should create vendor', async () => {
      const vendorData = {
        companyName: 'XYZ Materials',
        vendorCode: 'VENDOR-002',
        contactEmail: 'info@xyzmaterials.com',
        contactPhone: '555-0456',
        billingAddress: {
          street: '456 Material Ave',
          city: 'Houston',
          state: 'TX',
          postalCode: '77001',
          country: 'USA',
        },
        paymentTerms: 'NET_15',
        status: 'active' as const,
      };

      const createdVendor = { id: 'vendor-2', ...vendorData, createdAt: new Date(), updatedAt: new Date() };

      server.use(
        trpc.vendors.create.mutation((req) => {
          expect(req).toEqual(vendorData);
          return createdVendor;
        })
      );

      const result = await client.vendors.create.mutate(vendorData);
      expect(result).toEqual(createdVendor);
    });

    it('should update vendor', async () => {
      const updateData = { 
        contactEmail: 'newemail@abcsupply.com',
        paymentTerms: 'NET_45' 
      };
      const updatedVendor = { ...mockVendor, ...updateData, updatedAt: new Date() };

      server.use(
        trpc.vendors.update.mutation((req) => {
          expect(req.id).toBe('vendor-1');
          expect(req.data).toEqual(updateData);
          return updatedVendor;
        })
      );

      const result = await client.vendors.update.mutate({
        id: 'vendor-1',
        data: updateData,
      });

      expect(result).toEqual(updatedVendor);
    });

    it('should delete vendor', async () => {
      server.use(
        trpc.vendors.delete.mutation((req) => {
          expect(req).toBe('vendor-1');
          return { success: true };
        })
      );

      const result = await client.vendors.delete.mutate('vendor-1');
      expect(result).toEqual({ success: true });
    });

    it('should get vendor by ID', async () => {
      server.use(
        trpc.vendors.getById.query((req) => {
          expect(req).toBe('vendor-1');
          return mockVendor;
        })
      );

      const result = await client.vendors.getById.query('vendor-1');
      expect(result).toEqual(mockVendor);
    });
  });

  describe('Contacts', () => {
    const mockContact = {
      id: 'contact-1',
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice.johnson@example.com',
      phone: '555-7890',
      companyName: 'Johnson Consulting',
      title: 'Senior Consultant',
      address: {
        street: '789 Consultant Way',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'USA',
      },
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should list contacts', async () => {
      const mockContacts = {
        data: [mockContact],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.contacts.list.query(() => mockContacts)
      );

      const result = await client.contacts.list.query({
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockContacts);
    });

    it('should search contacts by name', async () => {
      const mockSearchResults = {
        data: [mockContact],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.contacts.list.query((req) => {
          expect(req.search).toBe('Alice');
          return mockSearchResults;
        })
      );

      const result = await client.contacts.list.query({
        search: 'Alice',
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockSearchResults);
    });

    it('should create contact', async () => {
      const contactData = {
        firstName: 'Bob',
        lastName: 'Wilson',
        email: 'bob.wilson@example.com',
        phone: '555-1111',
        companyName: 'Wilson & Associates',
        title: 'Partner',
        address: {
          street: '321 Partner Blvd',
          city: 'Dallas',
          state: 'TX',
          postalCode: '75201',
          country: 'USA',
        },
        status: 'active' as const,
      };

      const createdContact = { id: 'contact-2', ...contactData, createdAt: new Date(), updatedAt: new Date() };

      server.use(
        trpc.contacts.create.mutation((req) => {
          expect(req).toEqual(contactData);
          return createdContact;
        })
      );

      const result = await client.contacts.create.mutate(contactData);
      expect(result).toEqual(createdContact);
    });

    it('should update contact', async () => {
      const updateData = { 
        title: 'Principal Consultant',
        phone: '555-2222' 
      };
      const updatedContact = { ...mockContact, ...updateData, updatedAt: new Date() };

      server.use(
        trpc.contacts.update.mutation((req) => {
          expect(req.id).toBe('contact-1');
          expect(req.data).toEqual(updateData);
          return updatedContact;
        })
      );

      const result = await client.contacts.update.mutate({
        id: 'contact-1',
        data: updateData,
      });

      expect(result).toEqual(updatedContact);
    });

    it('should delete contact', async () => {
      server.use(
        trpc.contacts.delete.mutation((req) => {
          expect(req).toBe('contact-1');
          return { success: true };
        })
      );

      const result = await client.contacts.delete.mutate('contact-1');
      expect(result).toEqual({ success: true });
    });

    it('should get contact by ID', async () => {
      server.use(
        trpc.contacts.getById.query((req) => {
          expect(req).toBe('contact-1');
          return mockContact;
        })
      );

      const result = await client.contacts.getById.query('contact-1');
      expect(result).toEqual(mockContact);
    });
  });

  describe('Leads', () => {
    const mockLead = {
      id: 'lead-1',
      firstName: 'Sarah',
      lastName: 'Parker',
      email: 'sarah.parker@prospect.com',
      phone: '555-3333',
      companyName: 'Prospect Industries',
      leadSource: 'website',
      status: 'new' as const,
      notes: 'Interested in our services',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should list leads', async () => {
      const mockLeads = {
        data: [mockLead],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.leads.list.query(() => mockLeads)
      );

      const result = await client.leads.list.query({
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockLeads);
    });

    it('should filter leads by status', async () => {
      const mockNewLeads = {
        data: [mockLead],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.leads.list.query((req) => {
          expect(req.status).toBe('new');
          return mockNewLeads;
        })
      );

      const result = await client.leads.list.query({
        status: 'new',
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockNewLeads);
    });

    it('should create lead', async () => {
      const leadData = {
        firstName: 'Michael',
        lastName: 'Thompson',
        email: 'michael.thompson@newcorp.com',
        phone: '555-4444',
        companyName: 'New Corp',
        leadSource: 'referral',
        status: 'new' as const,
        notes: 'Referred by existing client',
      };

      const createdLead = { id: 'lead-2', ...leadData, createdAt: new Date(), updatedAt: new Date() };

      server.use(
        trpc.leads.create.mutation((req) => {
          expect(req).toEqual(leadData);
          return createdLead;
        })
      );

      const result = await client.leads.create.mutate(leadData);
      expect(result).toEqual(createdLead);
    });

    it('should update lead', async () => {
      const updateData = { 
        status: 'qualified' as const,
        notes: 'Updated notes after qualification' 
      };
      const updatedLead = { ...mockLead, ...updateData, updatedAt: new Date() };

      server.use(
        trpc.leads.update.mutation((req) => {
          expect(req.id).toBe('lead-1');
          expect(req.data).toEqual(updateData);
          return updatedLead;
        })
      );

      const result = await client.leads.update.mutate({
        id: 'lead-1',
        data: updateData,
      });

      expect(result).toEqual(updatedLead);
    });

    it('should delete lead', async () => {
      server.use(
        trpc.leads.delete.mutation((req) => {
          expect(req).toBe('lead-1');
          return { success: true };
        })
      );

      const result = await client.leads.delete.mutate('lead-1');
      expect(result).toEqual({ success: true });
    });

    it('should get lead by ID', async () => {
      server.use(
        trpc.leads.getById.query((req) => {
          expect(req).toBe('lead-1');
          return mockLead;
        })
      );

      const result = await client.leads.getById.query('lead-1');
      expect(result).toEqual(mockLead);
    });
  });

  describe('Prospects', () => {
    const mockProspect = {
      id: 'prospect-1',
      firstName: 'David',
      lastName: 'Chen',
      email: 'david.chen@futurecorp.com',
      phone: '555-5555',
      companyName: 'Future Corp',
      leadSource: 'trade_show',
      status: 'qualified' as const,
      estimatedValue: 50000,
      closeProbability: 75,
      expectedCloseDate: new Date('2024-12-31'),
      notes: 'High-value prospect with strong interest',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should list prospects', async () => {
      const mockProspects = {
        data: [mockProspect],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.prospects.list.query(() => mockProspects)
      );

      const result = await client.prospects.list.query({
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockProspects);
    });

    it('should filter prospects by status', async () => {
      const mockQualifiedProspects = {
        data: [mockProspect],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      };

      server.use(
        trpc.prospects.list.query((req) => {
          expect(req.status).toBe('qualified');
          return mockQualifiedProspects;
        })
      );

      const result = await client.prospects.list.query({
        status: 'qualified',
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockQualifiedProspects);
    });

    it('should create prospect', async () => {
      const prospectData = {
        firstName: 'Lisa',
        lastName: 'Wang',
        email: 'lisa.wang@nextgen.com',
        phone: '555-6666',
        companyName: 'NextGen Solutions',
        leadSource: 'cold_call',
        status: 'new' as const,
        estimatedValue: 75000,
        closeProbability: 50,
        expectedCloseDate: new Date('2024-11-30'),
        notes: 'New prospect from cold outreach',
      };

      const createdProspect = { id: 'prospect-2', ...prospectData, createdAt: new Date(), updatedAt: new Date() };

      server.use(
        trpc.prospects.create.mutation((req) => {
          expect(req).toEqual(prospectData);
          return createdProspect;
        })
      );

      const result = await client.prospects.create.mutate(prospectData);
      expect(result).toEqual(createdProspect);
    });

    it('should update prospect', async () => {
      const updateData = { 
        status: 'proposal_sent' as const,
        closeProbability: 80,
        notes: 'Proposal sent, awaiting response' 
      };
      const updatedProspect = { ...mockProspect, ...updateData, updatedAt: new Date() };

      server.use(
        trpc.prospects.update.mutation((req) => {
          expect(req.id).toBe('prospect-1');
          expect(req.data).toEqual(updateData);
          return updatedProspect;
        })
      );

      const result = await client.prospects.update.mutate({
        id: 'prospect-1',
        data: updateData,
      });

      expect(result).toEqual(updatedProspect);
    });

    it('should delete prospect', async () => {
      server.use(
        trpc.prospects.delete.mutation((req) => {
          expect(req).toBe('prospect-1');
          return { success: true };
        })
      );

      const result = await client.prospects.delete.mutate('prospect-1');
      expect(result).toEqual({ success: true });
    });

    it('should get prospect by ID', async () => {
      server.use(
        trpc.prospects.getById.query((req) => {
          expect(req).toBe('prospect-1');
          return mockProspect;
        })
      );

      const result = await client.prospects.getById.query('prospect-1');
      expect(result).toEqual(mockProspect);
    });
  });

  describe('Cross-entity relationships', () => {
    it('should handle customer-employee relationships', async () => {
      const mockCustomerEmployees = [
        {
          id: 'emp-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@customer.com',
          customerId: 'cust-1',
          role: 'primary_contact',
          status: 'active' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      server.use(
        trpc.customers.getEmployees.query((req) => {
          expect(req).toBe('cust-1');
          return mockCustomerEmployees;
        })
      );

      const result = await client.customers.getEmployees.query('cust-1');
      expect(result).toEqual(mockCustomerEmployees);
    });

    it('should handle vendor-contact relationships', async () => {
      const mockVendorContacts = [
        {
          id: 'contact-1',
          firstName: 'Alice',
          lastName: 'Johnson',
          email: 'alice@vendor.com',
          vendorId: 'vendor-1',
          role: 'procurement_contact',
          status: 'active' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      server.use(
        trpc.vendors.getContacts.query((req) => {
          expect(req).toBe('vendor-1');
          return mockVendorContacts;
        })
      );

      const result = await client.vendors.getContacts.query('vendor-1');
      expect(result).toEqual(mockVendorContacts);
    });
  });
});