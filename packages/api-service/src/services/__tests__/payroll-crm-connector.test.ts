/**
 * Payroll and CRM Connector Tests
 *
 * Tests for Gusto, Salesforce, and HubSpot connectors.
 * Uses mock HTTP clients for unit tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GustoConnector, GustoConfig } from '../gusto-connector';
import { SalesforceConnector, SalesforceConfig } from '../salesforce-connector';
import { HubSpotConnector, HubSpotConfig } from '../hubspot-connector';
import type { HttpClientInterface } from '../connector-framework';

// ============================================================================
// Mock HTTP Client
// ============================================================================

class MockHttpClient implements HttpClientInterface {
  public requests: Array<{
    method: string;
    url: string;
    options: { headers?: Record<string, string>; body?: string; timeout?: number };
  }> = [];
  private responses: Array<{ status: number; body: string; headers: Record<string, string> }> = [];
  private requestCount = 0;

  setResponses(responses: Array<{ status: number; body: string; headers?: Record<string, string> }>) {
    this.responses = responses.map((r) => ({
      ...r,
      headers: r.headers ?? {},
    }));
    this.requestCount = 0;
  }

  addResponse(status: number, body: unknown, headers?: Record<string, string>) {
    this.responses.push({
      status,
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: headers ?? {},
    });
  }

  async request(
    method: string,
    url: string,
    options: { headers?: Record<string, string>; body?: string; timeout?: number }
  ): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    this.requests.push({ method, url, options });
    const response = this.responses[this.requestCount] ?? { status: 200, body: '{}', headers: {} };
    this.requestCount++;
    return response;
  }

  async post(
    url: string,
    options: { headers?: Record<string, string>; body?: string; timeout?: number }
  ): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    return this.request('POST', url, options);
  }

  async get(
    url: string,
    options?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    return this.request('GET', url, options ?? {});
  }

  async patch(
    url: string,
    options: { headers?: Record<string, string>; body?: string; timeout?: number }
  ): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    return this.request('PATCH', url, options);
  }

  async put(
    url: string,
    options: { headers?: Record<string, string>; body?: string; timeout?: number }
  ): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    return this.request('PUT', url, options);
  }

  reset() {
    this.requests = [];
    this.responses = [];
    this.requestCount = 0;
  }

  getLastRequest() {
    return this.requests[this.requests.length - 1];
  }
}

// ============================================================================
// Test Data Fixtures - Gusto
// ============================================================================

const mockGustoEmployee = {
  id: 12345,
  uuid: 'emp-uuid-123',
  version: 'abc123',
  first_name: 'John',
  middle_initial: 'M',
  last_name: 'Doe',
  email: 'john.doe@example.com',
  company_id: 1,
  company_uuid: 'company-uuid-123',
  terminated: false,
  two_percent_shareholder: false,
  onboarded: true,
  jobs: [
    {
      id: 1,
      version: 'job-v1',
      employee_id: 12345,
      location_id: 1,
      location: {
        id: 1,
        version: 'loc-v1',
        company_id: 1,
        street_1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
        country: 'USA',
        active: true,
        mailing_address: true,
        filing_address: true,
      },
      hire_date: '2023-01-15',
      title: 'Software Engineer',
      primary: true,
      rate: '120000.00',
      payment_unit: 'Year',
      current_compensation_id: 1,
      compensations: [
        {
          id: 1,
          version: 'comp-v1',
          job_id: 1,
          rate: '120000.00',
          payment_unit: 'Year',
          flsa_status: 'Exempt',
          effective_date: '2023-01-15',
        },
      ],
    },
  ],
  home_address: {
    id: 1,
    version: 'addr-v1',
    street_1: '456 Oak Ave',
    city: 'San Francisco',
    state: 'CA',
    zip: '94107',
    country: 'USA',
  },
  garnishments: [],
  date_of_birth: '1990-05-20',
  has_ssn: true,
  phone: '555-123-4567',
};

const mockGustoPayroll = {
  version: 'payroll-v1',
  payroll_deadline: '2024-01-15',
  check_date: '2024-01-20',
  processed: true,
  processed_date: '2024-01-15',
  calculated_at: '2024-01-14',
  payroll_id: 1001,
  payroll_uuid: 'payroll-uuid-123',
  company_id: 1,
  company_uuid: 'company-uuid-123',
  pay_period: {
    start_date: '2024-01-01',
    end_date: '2024-01-14',
    pay_schedule_id: 1,
    pay_schedule_uuid: 'schedule-uuid-123',
  },
  totals: {
    company_debit: '15000.00',
    net_pay: '10000.00',
    tax_debit: '3000.00',
    reimbursements: '200.00',
    child_support_debit: '0.00',
    check_amount: '10200.00',
    employer_taxes: '1200.00',
    employee_taxes: '2500.00',
    benefits: '500.00',
    employee_benefits_deductions: '800.00',
    deferred_payroll_taxes: '0.00',
  },
  employee_compensations: [
    {
      employee_id: 12345,
      employee_uuid: 'emp-uuid-123',
      gross_pay: '5000.00',
      net_pay: '3500.00',
      check_amount: '3500.00',
      payment_method: 'Direct Deposit',
      fixed_compensations: [{ name: 'Salary', amount: '5000.00', job_id: 1 }],
      hourly_compensations: [],
      paid_time_off: [],
      benefits: [
        { name: 'Health Insurance', employee_deduction: '200.00', company_contribution: '400.00', imputed: false },
      ],
      deductions: [{ name: '401k', amount: '500.00' }],
      taxes: [
        { name: 'Federal Income Tax', employer: false, amount: '500.00' },
        { name: 'Social Security', employer: false, amount: '310.00' },
        { name: 'Medicare', employer: false, amount: '72.50' },
        { name: 'Social Security', employer: true, amount: '310.00' },
        { name: 'Medicare', employer: true, amount: '72.50' },
      ],
    },
  ],
};

// ============================================================================
// Test Data Fixtures - Salesforce
// ============================================================================

const mockSalesforceContact = {
  Id: 'contact-sf-123',
  Name: 'Jane Smith',
  FirstName: 'Jane',
  LastName: 'Smith',
  Email: 'jane.smith@example.com',
  Phone: '555-987-6543',
  MobilePhone: '555-555-5555',
  Title: 'VP of Sales',
  Department: 'Sales',
  AccountId: 'account-sf-456',
  OwnerId: 'user-sf-789',
  MailingStreet: '789 Business Blvd',
  MailingCity: 'New York',
  MailingState: 'NY',
  MailingPostalCode: '10001',
  MailingCountry: 'USA',
  LeadSource: 'Web',
  CreatedDate: '2023-06-15T10:30:00.000Z',
  LastModifiedDate: '2024-01-10T14:45:00.000Z',
  IsDeleted: false,
  SystemModstamp: '2024-01-10T14:45:00.000Z',
};

const mockSalesforceAccount = {
  Id: 'account-sf-456',
  Name: 'Acme Corporation',
  Type: 'Customer',
  Industry: 'Technology',
  Website: 'https://acme.example.com',
  Phone: '555-111-2222',
  Fax: '555-111-2223',
  Description: 'A leading technology company',
  NumberOfEmployees: 500,
  AnnualRevenue: 50000000,
  OwnerId: 'user-sf-789',
  BillingStreet: '100 Enterprise Way',
  BillingCity: 'San Jose',
  BillingState: 'CA',
  BillingPostalCode: '95110',
  BillingCountry: 'USA',
  SicCode: '7372',
  TickerSymbol: 'ACME',
  Rating: 'Hot',
  CreatedDate: '2022-01-15T08:00:00.000Z',
  LastModifiedDate: '2024-01-12T09:30:00.000Z',
  IsDeleted: false,
  SystemModstamp: '2024-01-12T09:30:00.000Z',
};

const mockSalesforceOpportunity = {
  Id: 'opp-sf-789',
  Name: 'Enterprise Deal - Acme',
  AccountId: 'account-sf-456',
  Amount: 250000,
  CloseDate: '2024-03-31',
  StageName: 'Negotiation',
  Probability: 75,
  Type: 'New Business',
  LeadSource: 'Partner Referral',
  Description: 'Large enterprise software deal',
  NextStep: 'Contract review',
  OwnerId: 'user-sf-789',
  IsClosed: false,
  IsWon: false,
  ForecastCategory: 'BestCase',
  CreatedDate: '2023-11-01T12:00:00.000Z',
  LastModifiedDate: '2024-01-14T16:00:00.000Z',
  IsDeleted: false,
  SystemModstamp: '2024-01-14T16:00:00.000Z',
};

// ============================================================================
// Test Data Fixtures - HubSpot
// ============================================================================

const mockHubSpotContact = {
  id: 'contact-hs-123',
  properties: {
    email: 'bob.jones@example.com',
    firstname: 'Bob',
    lastname: 'Jones',
    phone: '555-222-3333',
    mobilephone: '555-444-5555',
    jobtitle: 'Marketing Director',
    company: 'Widget Inc',
    address: '200 Market St',
    city: 'Chicago',
    state: 'IL',
    zip: '60601',
    country: 'USA',
    lifecyclestage: 'opportunity',
    hs_lead_status: 'qualified',
    hubspot_owner_id: 'owner-hs-1',
  },
  createdAt: '2023-05-20T14:00:00.000Z',
  updatedAt: '2024-01-08T11:30:00.000Z',
  archived: false,
};

const mockHubSpotCompany = {
  id: 'company-hs-456',
  properties: {
    name: 'Widget Industries',
    domain: 'widget.example.com',
    website: 'https://widget.example.com',
    phone: '555-666-7777',
    industry: 'Manufacturing',
    type: 'Customer',
    description: 'A manufacturing company',
    numberofemployees: '250',
    annualrevenue: '25000000',
    address: '300 Industrial Park',
    city: 'Detroit',
    state: 'MI',
    zip: '48201',
    country: 'USA',
    hubspot_owner_id: 'owner-hs-1',
  },
  createdAt: '2022-08-10T09:00:00.000Z',
  updatedAt: '2024-01-11T15:45:00.000Z',
  archived: false,
};

const mockHubSpotDeal = {
  id: 'deal-hs-789',
  properties: {
    dealname: 'Widget Expansion Project',
    amount: '75000',
    closedate: '2024-02-28',
    dealstage: 'qualifiedtobuy',
    pipeline: 'default',
    hubspot_owner_id: 'owner-hs-1',
    dealtype: 'existing_business',
    description: 'Expansion of current contract',
    hs_is_closed: 'false',
    hs_is_closed_won: 'false',
    hs_forecast_category: 'commit',
  },
  createdAt: '2023-12-01T10:00:00.000Z',
  updatedAt: '2024-01-13T12:00:00.000Z',
  archived: false,
};

const mockHubSpotPipeline = {
  id: 'pipeline-hs-1',
  label: 'Sales Pipeline',
  displayOrder: 0,
  stages: [
    { id: 'stage-1', label: 'Appointment Scheduled', displayOrder: 0, metadata: { isClosed: 'false', probability: '0.2' } },
    { id: 'stage-2', label: 'Qualified to Buy', displayOrder: 1, metadata: { isClosed: 'false', probability: '0.4' } },
    { id: 'stage-3', label: 'Contract Sent', displayOrder: 2, metadata: { isClosed: 'false', probability: '0.8' } },
    { id: 'stage-4', label: 'Closed Won', displayOrder: 3, metadata: { isClosed: 'true', probability: '1.0' } },
    { id: 'stage-5', label: 'Closed Lost', displayOrder: 4, metadata: { isClosed: 'true', probability: '0' } },
  ],
};

// ============================================================================
// Gusto Connector Tests
// ============================================================================

describe('GustoConnector', () => {
  let mockClient: MockHttpClient;
  let connector: GustoConnector;

  const gustoConfig: GustoConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    environment: 'sandbox',
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
  };

  beforeEach(() => {
    mockClient = new MockHttpClient();
    connector = new GustoConnector({ organizationId: 'org-123' }, gustoConfig, mockClient);
  });

  describe('testConnection', () => {
    it('should return success when connection is valid', async () => {
      mockClient.addResponse(200, { email: 'admin@example.com', uuid: 'user-uuid-123' });

      const result = await connector.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully connected');
      expect(result.details?.userEmail).toBe('admin@example.com');
    });

    it('should return failure on API error', async () => {
      mockClient.addResponse(401, { error: 'Unauthorized' });
      mockClient.addResponse(401, { error: 'Unauthorized' });
      mockClient.addResponse(401, { error: 'Unauthorized' });

      const result = await connector.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to connect');
    });
  });

  describe('getEmployees', () => {
    it('should fetch employees for a company', async () => {
      mockClient.addResponse(200, [mockGustoEmployee]);

      const employees = await connector.getEmployees('company-123');

      expect(employees).toHaveLength(1);
      expect(employees[0].first_name).toBe('John');
      expect(employees[0].last_name).toBe('Doe');

      const lastRequest = mockClient.getLastRequest();
      expect(lastRequest?.url).toContain('/companies/company-123/employees');
    });

    it('should include terminated filter when specified', async () => {
      mockClient.addResponse(200, []);

      await connector.getEmployees('company-123', { terminated: true });

      const lastRequest = mockClient.getLastRequest();
      expect(lastRequest?.url).toContain('terminated=true');
    });
  });

  describe('getPayrolls', () => {
    it('should fetch processed payrolls', async () => {
      mockClient.addResponse(200, [mockGustoPayroll]);

      const payrolls = await connector.getPayrolls('company-123', { processed: true });

      expect(payrolls).toHaveLength(1);
      expect(payrolls[0].processed).toBe(true);
      expect(payrolls[0].check_date).toBe('2024-01-20');
    });

    it('should apply date filters', async () => {
      mockClient.addResponse(200, []);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      await connector.getPayrolls('company-123', { startDate, endDate });

      const lastRequest = mockClient.getLastRequest();
      expect(lastRequest?.url).toContain('start_date=2024-01-01');
      expect(lastRequest?.url).toContain('end_date=2024-01-31');
    });
  });

  describe('normalizeEmployee', () => {
    it('should normalize Gusto employee to standard format', () => {
      const normalized = connector.normalizeEmployee(mockGustoEmployee, 'org-123');

      expect(normalized.id).toBe('gusto-emp-emp-uuid-123');
      expect(normalized.firstName).toBe('John');
      expect(normalized.lastName).toBe('Doe');
      expect(normalized.email).toBe('john.doe@example.com');
      expect(normalized.status).toBe('active');
      expect(normalized.jobTitle).toBe('Software Engineer');
      expect(normalized.compensation.payRate).toBe(120000);
      expect(normalized.compensation.payType).toBe('salary');
    });

    it('should mark terminated employees correctly', () => {
      const terminated = { ...mockGustoEmployee, terminated: true };
      const normalized = connector.normalizeEmployee(terminated, 'org-123');

      expect(normalized.status).toBe('terminated');
    });
  });

  describe('normalizePayroll', () => {
    it('should normalize Gusto payroll to standard format', () => {
      const normalized = connector.normalizePayroll(mockGustoPayroll, 'org-123');

      expect(normalized.id).toBe('gusto-payroll-payroll-uuid-123');
      expect(normalized.status).toBe('completed');
      expect(normalized.paystubs).toHaveLength(1);
      expect(normalized.totals.netPay).toBe(10000);
      expect(normalized.totals.employerTaxes).toBe(1200);
    });
  });

  describe('syncPayrollData', () => {
    it('should sync employees and payrolls', async () => {
      mockClient.addResponse(200, [mockGustoEmployee, mockGustoEmployee]);
      mockClient.addResponse(200, [mockGustoPayroll]);

      const result = await connector.syncPayrollData('company-123');

      expect(result.success).toBe(true);
      expect(result.employeesSynced).toBe(2);
      expect(result.payrollRunsSynced).toBe(1);
    });

    it('should handle sync errors gracefully', async () => {
      mockClient.addResponse(500, { error: 'Server error' });
      mockClient.addResponse(500, { error: 'Server error' });
      mockClient.addResponse(500, { error: 'Server error' });

      const result = await connector.syncPayrollData('company-123');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Salesforce Connector Tests
// ============================================================================

describe('SalesforceConnector', () => {
  let mockClient: MockHttpClient;
  let connector: SalesforceConnector;

  const sfConfig: SalesforceConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    instanceUrl: 'https://test.salesforce.com',
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
  };

  beforeEach(() => {
    mockClient = new MockHttpClient();
    connector = new SalesforceConnector({ organizationId: 'org-123' }, sfConfig, mockClient);
  });

  describe('testConnection', () => {
    it('should return success when connection is valid', async () => {
      mockClient.addResponse(200, {
        identity: 'https://test.salesforce.com/id/00D',
        username: 'admin@test.salesforce.com',
        organization_id: 'org-sf-123',
        display_name: 'Test Admin',
      });

      const result = await connector.testConnection();

      expect(result.success).toBe(true);
      expect(result.details?.username).toBe('admin@test.salesforce.com');
    });

    it('should return failure on API error', async () => {
      mockClient.addResponse(401, { errorCode: 'INVALID_SESSION_ID' });
      mockClient.addResponse(401, { errorCode: 'INVALID_SESSION_ID' });
      mockClient.addResponse(401, { errorCode: 'INVALID_SESSION_ID' });

      const result = await connector.testConnection();

      expect(result.success).toBe(false);
    });
  });

  describe('query', () => {
    it('should execute SOQL queries', async () => {
      mockClient.addResponse(200, {
        totalSize: 1,
        done: true,
        records: [mockSalesforceContact],
      });

      const result = await connector.query<typeof mockSalesforceContact>(
        "SELECT Id, Name FROM Contact WHERE Email != null"
      );

      expect(result.totalSize).toBe(1);
      expect(result.records[0].FirstName).toBe('Jane');
    });
  });

  describe('getContacts', () => {
    it('should fetch contacts', async () => {
      mockClient.addResponse(200, {
        totalSize: 1,
        done: true,
        records: [mockSalesforceContact],
      });

      const contacts = await connector.getContacts();

      expect(contacts).toHaveLength(1);
      expect(contacts[0].Email).toBe('jane.smith@example.com');
    });
  });

  describe('getAccounts', () => {
    it('should fetch accounts', async () => {
      mockClient.addResponse(200, {
        totalSize: 1,
        done: true,
        records: [mockSalesforceAccount],
      });

      const accounts = await connector.getAccounts();

      expect(accounts).toHaveLength(1);
      expect(accounts[0].Name).toBe('Acme Corporation');
      expect(accounts[0].AnnualRevenue).toBe(50000000);
    });
  });

  describe('getOpportunities', () => {
    it('should fetch opportunities', async () => {
      mockClient.addResponse(200, {
        totalSize: 1,
        done: true,
        records: [mockSalesforceOpportunity],
      });

      const opportunities = await connector.getOpportunities();

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].Amount).toBe(250000);
      expect(opportunities[0].StageName).toBe('Negotiation');
    });
  });

  describe('normalizeContact', () => {
    it('should normalize Salesforce contact to standard format', () => {
      const normalized = connector.normalizeContact(mockSalesforceContact, 'org-123');

      expect(normalized.id).toBe('sf-contact-contact-sf-123');
      expect(normalized.firstName).toBe('Jane');
      expect(normalized.lastName).toBe('Smith');
      expect(normalized.emails[0].email).toBe('jane.smith@example.com');
      expect(normalized.phones[0].phone).toBe('555-987-6543');
      expect(normalized.title).toBe('VP of Sales');
    });
  });

  describe('normalizeAccount', () => {
    it('should normalize Salesforce account to standard format', () => {
      const normalized = connector.normalizeAccount(mockSalesforceAccount, 'org-123');

      expect(normalized.id).toBe('sf-account-account-sf-456');
      expect(normalized.name).toBe('Acme Corporation');
      expect(normalized.industry).toBe('Technology');
      expect(normalized.annualRevenue).toBe(50000000);
      expect(normalized.rating).toBe('hot');
    });
  });

  describe('normalizeOpportunity', () => {
    it('should normalize Salesforce opportunity to standard format', () => {
      const normalized = connector.normalizeOpportunity(mockSalesforceOpportunity, 'org-123');

      expect(normalized.id).toBe('sf-opp-opp-sf-789');
      expect(normalized.name).toBe('Enterprise Deal - Acme');
      expect(normalized.amount).toBe(250000);
      expect(normalized.probability).toBe(75);
      expect(normalized.isClosed).toBe(false);
      expect(normalized.forecastCategory).toBe('best_case');
    });
  });

  describe('syncCRMData', () => {
    it('should sync all CRM entities', async () => {
      // Contacts
      mockClient.addResponse(200, { totalSize: 2, done: true, records: [mockSalesforceContact, mockSalesforceContact] });
      // Accounts
      mockClient.addResponse(200, { totalSize: 1, done: true, records: [mockSalesforceAccount] });
      // Opportunities
      mockClient.addResponse(200, { totalSize: 3, done: true, records: [mockSalesforceOpportunity, mockSalesforceOpportunity, mockSalesforceOpportunity] });
      // Tasks
      mockClient.addResponse(200, { totalSize: 1, done: true, records: [] });
      // Events
      mockClient.addResponse(200, { totalSize: 1, done: true, records: [] });

      const result = await connector.syncCRMData();

      expect(result.success).toBe(true);
      expect(result.contactsSynced).toBe(2);
      expect(result.accountsSynced).toBe(1);
      expect(result.opportunitiesSynced).toBe(3);
    });
  });
});

// ============================================================================
// HubSpot Connector Tests
// ============================================================================

describe('HubSpotConnector', () => {
  let mockClient: MockHttpClient;
  let connector: HubSpotConnector;

  const hsConfig: HubSpotConfig = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
  };

  beforeEach(() => {
    mockClient = new MockHttpClient();
    connector = new HubSpotConnector({ organizationId: 'org-123' }, hsConfig, mockClient);
  });

  describe('testConnection', () => {
    it('should return success when connection is valid', async () => {
      mockClient.addResponse(200, {
        portalId: 12345678,
        uiDomain: 'app.hubspot.com',
        dataHostingLocation: 'na1',
      });

      const result = await connector.testConnection();

      expect(result.success).toBe(true);
      expect(result.details?.portalId).toBe(12345678);
    });

    it('should return failure on API error', async () => {
      mockClient.addResponse(401, { status: 'error', message: 'Invalid token' });
      mockClient.addResponse(401, { status: 'error', message: 'Invalid token' });
      mockClient.addResponse(401, { status: 'error', message: 'Invalid token' });

      const result = await connector.testConnection();

      expect(result.success).toBe(false);
    });
  });

  describe('getContacts', () => {
    it('should fetch contacts', async () => {
      mockClient.addResponse(200, {
        results: [mockHubSpotContact],
        paging: null,
      });

      const response = await connector.getContacts();

      expect(response.results).toHaveLength(1);
      expect(response.results[0].properties.email).toBe('bob.jones@example.com');
    });

    it('should handle pagination', async () => {
      mockClient.addResponse(200, {
        results: [mockHubSpotContact],
        paging: { next: { after: 'cursor-1', link: 'https://api.hubapi.com/...' } },
      });
      mockClient.addResponse(200, {
        results: [{ ...mockHubSpotContact, id: 'contact-hs-456' }],
        paging: null,
      });

      const contacts = await connector.getAllContacts();

      expect(contacts).toHaveLength(2);
    });
  });

  describe('getCompanies', () => {
    it('should fetch companies', async () => {
      mockClient.addResponse(200, {
        results: [mockHubSpotCompany],
        paging: null,
      });

      const response = await connector.getCompanies();

      expect(response.results).toHaveLength(1);
      expect(response.results[0].properties.name).toBe('Widget Industries');
    });
  });

  describe('getDeals', () => {
    it('should fetch deals', async () => {
      mockClient.addResponse(200, {
        results: [mockHubSpotDeal],
        paging: null,
      });

      const response = await connector.getDeals();

      expect(response.results).toHaveLength(1);
      expect(response.results[0].properties.dealname).toBe('Widget Expansion Project');
    });
  });

  describe('getPipelines', () => {
    it('should fetch deal pipelines', async () => {
      mockClient.addResponse(200, { results: [mockHubSpotPipeline] });

      const pipelines = await connector.getDealPipelines();

      expect(pipelines).toHaveLength(1);
      expect(pipelines[0].name).toBe('Sales Pipeline');
      expect(pipelines[0].stages).toHaveLength(5);
    });
  });

  describe('normalizeContact', () => {
    it('should normalize HubSpot contact to standard format', () => {
      const normalized = connector.normalizeContact(mockHubSpotContact, 'org-123');

      expect(normalized.id).toBe('hs-contact-contact-hs-123');
      expect(normalized.firstName).toBe('Bob');
      expect(normalized.lastName).toBe('Jones');
      expect(normalized.emails[0].email).toBe('bob.jones@example.com');
      expect(normalized.lifecycleStage).toBe('opportunity');
    });
  });

  describe('normalizeCompany', () => {
    it('should normalize HubSpot company to standard account format', () => {
      const normalized = connector.normalizeCompany(mockHubSpotCompany, 'org-123');

      expect(normalized.id).toBe('hs-company-company-hs-456');
      expect(normalized.name).toBe('Widget Industries');
      expect(normalized.numberOfEmployees).toBe(250);
      expect(normalized.annualRevenue).toBe(25000000);
    });
  });

  describe('normalizeDeal', () => {
    it('should normalize HubSpot deal to standard opportunity format', () => {
      const normalized = connector.normalizeDeal(mockHubSpotDeal, 'org-123');

      expect(normalized.id).toBe('hs-deal-deal-hs-789');
      expect(normalized.name).toBe('Widget Expansion Project');
      expect(normalized.amount).toBe(75000);
      expect(normalized.forecastCategory).toBe('commit');
    });
  });

  describe('syncCRMData', () => {
    it('should sync all CRM entities', async () => {
      // Contacts
      mockClient.addResponse(200, { results: [mockHubSpotContact, mockHubSpotContact], paging: null });
      // Companies
      mockClient.addResponse(200, { results: [mockHubSpotCompany], paging: null });
      // Deals
      mockClient.addResponse(200, { results: [mockHubSpotDeal, mockHubSpotDeal, mockHubSpotDeal], paging: null });
      // Tasks
      mockClient.addResponse(200, { results: [], paging: null });
      // Calls
      mockClient.addResponse(200, { results: [], paging: null });
      // Meetings
      mockClient.addResponse(200, { results: [], paging: null });

      const result = await connector.syncCRMData();

      expect(result.success).toBe(true);
      expect(result.contactsSynced).toBe(2);
      expect(result.accountsSynced).toBe(1);
      expect(result.opportunitiesSynced).toBe(3);
    });

    it('should handle partial failures', async () => {
      // Contacts - success
      mockClient.addResponse(200, { results: [mockHubSpotContact], paging: null });
      // Companies - error
      mockClient.addResponse(500, { status: 'error' });
      mockClient.addResponse(500, { status: 'error' });
      mockClient.addResponse(500, { status: 'error' });

      const result = await connector.syncCRMData({ syncOpportunities: false, syncActivities: false });

      expect(result.success).toBe(false);
      expect(result.contactsSynced).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
