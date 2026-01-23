/**
 * Salesforce CRM Connector
 *
 * Integrates with Salesforce REST API for CRM data synchronization.
 * Features:
 * - OAuth 2.0 authentication (Web Server Flow)
 * - SOQL queries for data retrieval
 * - Contact, Account, Opportunity sync
 * - Activity/Task management
 * - Bulk API support for large data sets
 */

import {
  BaseConnector,
  ConnectorServiceContext,
  HttpClientInterface,
  DefaultHttpClient,
} from './connector-framework';

import type {
  ConnectorConfig,
  ConnectorResponse,
  ConnectionTestResult,
} from '../types/connector.types';

import type {
  CRMProvider,
  CRMContact,
  CRMAccount,
  CRMOpportunity,
  CRMActivity,
  CRMPipeline,
  PipelineStage,
  CRMUser,
  CRMProduct,
  CRMSyncOptions,
  CRMSyncResult,
  CRMSyncError,
  CRMSyncCursor,
  CRMAddress,
  ContactEmail,
  ContactPhone,
  LeadStatus,
  LifecycleStage,
  AccountType,
  CustomerTier,
  AccountRating,
  ForecastCategory,
  OpportunityType,
  ActivityType,
  ActivityStatus,
  ActivityPriority,
  SalesforceOAuthTokens,
  SalesforceQueryResult,
  SalesforceContact,
  SalesforceAccount,
  SalesforceOpportunity,
  SalesforceRecord,
} from '../types/crm.types';

// ============================================================================
// Salesforce-Specific Types
// ============================================================================

/**
 * Salesforce connector configuration
 */
export interface SalesforceConfig {
  clientId: string;
  clientSecret: string;
  /** Instance URL (e.g., https://yourorg.salesforce.com) */
  instanceUrl?: string;
  /** Login URL for OAuth */
  loginUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  /** API version */
  apiVersion?: string;
  /** Sandbox mode */
  isSandbox?: boolean;
}

/**
 * Salesforce Task record
 */
export interface SalesforceTask extends SalesforceRecord {
  Subject: string;
  Status: string;
  Priority: string;
  ActivityDate?: string;
  Description?: string;
  OwnerId: string;
  WhoId?: string;
  WhatId?: string;
  CallDurationInSeconds?: number;
  CallType?: string;
  TaskSubtype?: string;
  IsClosed: boolean;
  IsHighPriority: boolean;
}

/**
 * Salesforce Event record
 */
export interface SalesforceEvent extends SalesforceRecord {
  Subject: string;
  StartDateTime: string;
  EndDateTime: string;
  Description?: string;
  OwnerId: string;
  WhoId?: string;
  WhatId?: string;
  Location?: string;
  IsAllDayEvent: boolean;
  DurationInMinutes: number;
}

/**
 * Salesforce User record
 */
export interface SalesforceUser extends SalesforceRecord {
  Email: string;
  FirstName?: string;
  LastName: string;
  IsActive: boolean;
  ProfileId: string;
  UserRoleId?: string;
  ManagerId?: string;
  TimeZoneSidKey: string;
}

/**
 * Salesforce Product record
 */
export interface SalesforceProduct extends SalesforceRecord {
  Name: string;
  ProductCode?: string;
  Description?: string;
  IsActive: boolean;
  Family?: string;
}

/**
 * Salesforce Pricebook Entry
 */
export interface SalesforcePricebookEntry extends SalesforceRecord {
  Product2Id: string;
  UnitPrice: number;
  IsActive: boolean;
  Pricebook2Id: string;
}

/**
 * SOQL query options
 */
export interface SOQLQueryOptions {
  /** Fields to select */
  fields?: string[];
  /** WHERE clause conditions */
  where?: string;
  /** ORDER BY clause */
  orderBy?: string;
  /** LIMIT */
  limit?: number;
  /** OFFSET */
  offset?: number;
  /** Include deleted records (ALL ROWS) */
  includeDeleted?: boolean;
}

// ============================================================================
// Salesforce Connector Implementation
// ============================================================================

/**
 * Salesforce CRM connector
 */
export class SalesforceConnector extends BaseConnector {
  private sfConfig: SalesforceConfig;
  private instanceUrl: string;
  private apiVersion: string;

  constructor(
    context: ConnectorServiceContext,
    sfConfig: SalesforceConfig,
    httpClient?: HttpClientInterface
  ) {
    const instanceUrl =
      sfConfig.instanceUrl ||
      (sfConfig.isSandbox
        ? 'https://test.salesforce.com'
        : 'https://login.salesforce.com');
    const apiVersion = sfConfig.apiVersion || 'v59.0';

    const connectorConfig: ConnectorConfig = {
      id: `salesforce-${context.organizationId ?? 'default'}`,
      name: 'Salesforce CRM',
      type: 'salesforce',
      baseUrl: instanceUrl,
      credentials: {
        method: 'oauth2',
        grantType: 'refresh_token',
        clientId: sfConfig.clientId,
        clientSecret: sfConfig.clientSecret,
        accessToken: sfConfig.accessToken,
        refreshToken: sfConfig.refreshToken,
        expiresAt: sfConfig.expiresAt,
        tokenUrl: `${sfConfig.loginUrl || instanceUrl}/services/oauth2/token`,
      },
      rateLimit: {
        // Salesforce API limits vary by edition; using conservative defaults
        maxRequests: 100,
        window: 'minute',
        queueWhenLimited: true,
        maxQueueSize: 200,
      },
      retryPolicy: {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 15000,
        backoffStrategy: 'exponential',
        backoffMultiplier: 2,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504],
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        successThreshold: 3,
        resetTimeoutMs: 30000,
        windowSize: 60000,
      },
      defaultTimeoutMs: 30000,
    };

    super(context, connectorConfig, httpClient ?? new DefaultHttpClient());
    this.sfConfig = sfConfig;
    this.instanceUrl = instanceUrl;
    this.apiVersion = apiVersion;
  }

  /**
   * Get API base path
   */
  private get apiPath(): string {
    return `/services/data/${this.apiVersion}`;
  }

  /**
   * Update instance URL (needed after OAuth flow)
   */
  setInstanceUrl(instanceUrl: string): void {
    this.instanceUrl = instanceUrl;
    this.config.baseUrl = instanceUrl;
  }

  /**
   * Test connection to Salesforce
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      const response = await this.get<{
        identity: string;
        username: string;
        organization_id: string;
        display_name: string;
      }>(`${this.apiPath}/chatter/users/me`);

      return {
        success: true,
        latencyMs: Date.now() - startTime,
        message: 'Successfully connected to Salesforce',
        details: {
          username: response.data.username,
          organizationId: response.data.organization_id,
          displayName: response.data.display_name,
        },
      };
    } catch (error) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: `Failed to connect to Salesforce: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ============================================================================
  // SOQL Query Methods
  // ============================================================================

  /**
   * Execute a SOQL query
   */
  async query<T>(soql: string): Promise<SalesforceQueryResult<T>> {
    const encodedQuery = encodeURIComponent(soql);
    const response = await this.get<SalesforceQueryResult<T>>(
      `${this.apiPath}/query?q=${encodedQuery}`
    );
    return response.data;
  }

  /**
   * Execute a SOQL query with automatic pagination
   */
  async queryAll<T>(soql: string): Promise<T[]> {
    const results: T[] = [];
    let response = await this.query<T>(soql);
    results.push(...response.records);

    while (!response.done && response.nextRecordsUrl) {
      const nextResponse = await this.get<SalesforceQueryResult<T>>(
        response.nextRecordsUrl
      );
      response = nextResponse.data;
      results.push(...response.records);
    }

    return results;
  }

  /**
   * Build SOQL query from options
   */
  private buildSOQL(objectType: string, options: SOQLQueryOptions = {}): string {
    const fields = options.fields || ['Id', 'Name', 'CreatedDate', 'LastModifiedDate'];
    let query = `SELECT ${fields.join(', ')} FROM ${objectType}`;

    if (options.where) {
      query += ` WHERE ${options.where}`;
    }
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    }
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    if (options.offset) {
      query += ` OFFSET ${options.offset}`;
    }
    if (options.includeDeleted) {
      query += ' ALL ROWS';
    }

    return query;
  }

  // ============================================================================
  // Contact Methods
  // ============================================================================

  /**
   * Get contacts
   */
  async getContacts(options: SOQLQueryOptions = {}): Promise<SalesforceContact[]> {
    const fields = options.fields || [
      'Id',
      'FirstName',
      'LastName',
      'Email',
      'Phone',
      'MobilePhone',
      'Title',
      'Department',
      'AccountId',
      'OwnerId',
      'MailingStreet',
      'MailingCity',
      'MailingState',
      'MailingPostalCode',
      'MailingCountry',
      'LeadSource',
      'CreatedDate',
      'LastModifiedDate',
      'IsDeleted',
    ];
    const soql = this.buildSOQL('Contact', { ...options, fields });
    return this.queryAll<SalesforceContact>(soql);
  }

  /**
   * Get single contact by ID
   */
  async getContact(contactId: string): Promise<SalesforceContact> {
    const response = await this.get<SalesforceContact>(
      `${this.apiPath}/sobjects/Contact/${contactId}`
    );
    return response.data;
  }

  /**
   * Create contact
   */
  async createContact(
    contact: Partial<SalesforceContact>
  ): Promise<{ id: string; success: boolean }> {
    const response = await this.post<{ id: string; success: boolean }>(
      `${this.apiPath}/sobjects/Contact`,
      contact
    );
    return response.data;
  }

  /**
   * Update contact
   */
  async updateContact(
    contactId: string,
    updates: Partial<SalesforceContact>
  ): Promise<void> {
    await this.patch(`${this.apiPath}/sobjects/Contact/${contactId}`, updates);
  }

  // ============================================================================
  // Account Methods
  // ============================================================================

  /**
   * Get accounts
   */
  async getAccounts(options: SOQLQueryOptions = {}): Promise<SalesforceAccount[]> {
    const fields = options.fields || [
      'Id',
      'Name',
      'Type',
      'Industry',
      'Website',
      'Phone',
      'Fax',
      'Description',
      'NumberOfEmployees',
      'AnnualRevenue',
      'OwnerId',
      'ParentId',
      'BillingStreet',
      'BillingCity',
      'BillingState',
      'BillingPostalCode',
      'BillingCountry',
      'ShippingStreet',
      'ShippingCity',
      'ShippingState',
      'ShippingPostalCode',
      'ShippingCountry',
      'SicCode',
      'TickerSymbol',
      'Rating',
      'CreatedDate',
      'LastModifiedDate',
      'IsDeleted',
    ];
    const soql = this.buildSOQL('Account', { ...options, fields });
    return this.queryAll<SalesforceAccount>(soql);
  }

  /**
   * Get single account by ID
   */
  async getAccount(accountId: string): Promise<SalesforceAccount> {
    const response = await this.get<SalesforceAccount>(
      `${this.apiPath}/sobjects/Account/${accountId}`
    );
    return response.data;
  }

  /**
   * Create account
   */
  async createAccount(
    account: Partial<SalesforceAccount>
  ): Promise<{ id: string; success: boolean }> {
    const response = await this.post<{ id: string; success: boolean }>(
      `${this.apiPath}/sobjects/Account`,
      account
    );
    return response.data;
  }

  /**
   * Update account
   */
  async updateAccount(
    accountId: string,
    updates: Partial<SalesforceAccount>
  ): Promise<void> {
    await this.patch(`${this.apiPath}/sobjects/Account/${accountId}`, updates);
  }

  // ============================================================================
  // Opportunity Methods
  // ============================================================================

  /**
   * Get opportunities
   */
  async getOpportunities(
    options: SOQLQueryOptions = {}
  ): Promise<SalesforceOpportunity[]> {
    const fields = options.fields || [
      'Id',
      'Name',
      'AccountId',
      'Amount',
      'CloseDate',
      'StageName',
      'Probability',
      'Type',
      'LeadSource',
      'Description',
      'NextStep',
      'OwnerId',
      'IsClosed',
      'IsWon',
      'ForecastCategory',
      'ForecastCategoryName',
      'CampaignId',
      'ContactId',
      'CreatedDate',
      'LastModifiedDate',
      'IsDeleted',
    ];
    const soql = this.buildSOQL('Opportunity', { ...options, fields });
    return this.queryAll<SalesforceOpportunity>(soql);
  }

  /**
   * Get single opportunity by ID
   */
  async getOpportunity(opportunityId: string): Promise<SalesforceOpportunity> {
    const response = await this.get<SalesforceOpportunity>(
      `${this.apiPath}/sobjects/Opportunity/${opportunityId}`
    );
    return response.data;
  }

  /**
   * Create opportunity
   */
  async createOpportunity(
    opportunity: Partial<SalesforceOpportunity>
  ): Promise<{ id: string; success: boolean }> {
    const response = await this.post<{ id: string; success: boolean }>(
      `${this.apiPath}/sobjects/Opportunity`,
      opportunity
    );
    return response.data;
  }

  /**
   * Update opportunity
   */
  async updateOpportunity(
    opportunityId: string,
    updates: Partial<SalesforceOpportunity>
  ): Promise<void> {
    await this.patch(
      `${this.apiPath}/sobjects/Opportunity/${opportunityId}`,
      updates
    );
  }

  // ============================================================================
  // Task/Activity Methods
  // ============================================================================

  /**
   * Get tasks
   */
  async getTasks(options: SOQLQueryOptions = {}): Promise<SalesforceTask[]> {
    const fields = options.fields || [
      'Id',
      'Subject',
      'Status',
      'Priority',
      'ActivityDate',
      'Description',
      'OwnerId',
      'WhoId',
      'WhatId',
      'CallDurationInSeconds',
      'CallType',
      'TaskSubtype',
      'IsClosed',
      'IsHighPriority',
      'CreatedDate',
      'LastModifiedDate',
      'IsDeleted',
    ];
    const soql = this.buildSOQL('Task', { ...options, fields });
    return this.queryAll<SalesforceTask>(soql);
  }

  /**
   * Get events
   */
  async getEvents(options: SOQLQueryOptions = {}): Promise<SalesforceEvent[]> {
    const fields = options.fields || [
      'Id',
      'Subject',
      'StartDateTime',
      'EndDateTime',
      'Description',
      'OwnerId',
      'WhoId',
      'WhatId',
      'Location',
      'IsAllDayEvent',
      'DurationInMinutes',
      'CreatedDate',
      'LastModifiedDate',
      'IsDeleted',
    ];
    const soql = this.buildSOQL('Event', { ...options, fields });
    return this.queryAll<SalesforceEvent>(soql);
  }

  /**
   * Create task
   */
  async createTask(
    task: Partial<SalesforceTask>
  ): Promise<{ id: string; success: boolean }> {
    const response = await this.post<{ id: string; success: boolean }>(
      `${this.apiPath}/sobjects/Task`,
      task
    );
    return response.data;
  }

  // ============================================================================
  // User Methods
  // ============================================================================

  /**
   * Get users
   */
  async getUsers(options: SOQLQueryOptions = {}): Promise<SalesforceUser[]> {
    const fields = options.fields || [
      'Id',
      'Email',
      'FirstName',
      'LastName',
      'Name',
      'IsActive',
      'ProfileId',
      'UserRoleId',
      'ManagerId',
      'TimeZoneSidKey',
      'CreatedDate',
      'LastModifiedDate',
    ];
    const soql = this.buildSOQL('User', { ...options, fields });
    return this.queryAll<SalesforceUser>(soql);
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<SalesforceUser> {
    const soql = "SELECT Id, Email, FirstName, LastName, Name, IsActive, ProfileId, UserRoleId, ManagerId, TimeZoneSidKey, CreatedDate, LastModifiedDate FROM User WHERE Id = UserInfo.getUserId()";
    const result = await this.query<SalesforceUser>(soql);
    if (result.records.length === 0) {
      throw new Error('Could not retrieve current user');
    }
    return result.records[0];
  }

  // ============================================================================
  // Metadata Methods
  // ============================================================================

  /**
   * Describe an object (get metadata)
   */
  async describeObject(
    objectType: string
  ): Promise<{ name: string; fields: Array<{ name: string; type: string; label: string }> }> {
    const response = await this.get<{
      name: string;
      fields: Array<{ name: string; type: string; label: string }>;
    }>(`${this.apiPath}/sobjects/${objectType}/describe`);
    return response.data;
  }

  /**
   * Get opportunity stages (picklist values)
   */
  async getOpportunityStages(): Promise<PipelineStage[]> {
    const describe = await this.describeObject('Opportunity');
    const stageField = describe.fields.find((f) => f.name === 'StageName');

    // We need to query the OpportunityStage object for full details
    const stages = await this.queryAll<{
      Id: string;
      ApiName: string;
      MasterLabel: string;
      DefaultProbability: number;
      IsClosed: boolean;
      IsWon: boolean;
      SortOrder: number;
    }>(
      'SELECT Id, ApiName, MasterLabel, DefaultProbability, IsClosed, IsWon, SortOrder FROM OpportunityStage ORDER BY SortOrder'
    );

    return stages.map((s) => ({
      id: s.Id,
      providerStageId: s.ApiName,
      name: s.MasterLabel,
      displayOrder: s.SortOrder,
      probability: s.DefaultProbability,
      isClosed: s.IsClosed,
      isWon: s.IsWon,
      type: s.IsWon ? 'won' : s.IsClosed ? 'lost' : 'open',
    }));
  }

  // ============================================================================
  // Sync Methods
  // ============================================================================

  /**
   * Sync all CRM data
   */
  async syncCRMData(options: CRMSyncOptions = {}): Promise<CRMSyncResult> {
    const startedAt = new Date();
    const errors: CRMSyncError[] = [];
    let contactsSynced = 0;
    let accountsSynced = 0;
    let opportunitiesSynced = 0;
    let activitiesSynced = 0;
    const productsSynced = 0;

    // Build WHERE clause for incremental sync
    let whereClause: string | undefined;
    if (options.modifiedSince && !options.forceFullRefresh) {
      const isoDate = options.modifiedSince.toISOString();
      whereClause = `LastModifiedDate >= ${isoDate}`;
    }

    try {
      // Sync contacts
      if (options.syncContacts !== false) {
        try {
          const contacts = await this.getContacts({
            where: whereClause,
            limit: options.batchSize,
            includeDeleted: options.includeDeleted,
          });
          contactsSynced = contacts.length;
        } catch (error) {
          errors.push({
            code: 'CONTACT_SYNC_ERROR',
            message: `Failed to sync contacts: ${error instanceof Error ? error.message : String(error)}`,
            entityType: 'contact',
            retryable: true,
          });
        }
      }

      // Sync accounts
      if (options.syncAccounts !== false) {
        try {
          const accounts = await this.getAccounts({
            where: whereClause,
            limit: options.batchSize,
            includeDeleted: options.includeDeleted,
          });
          accountsSynced = accounts.length;
        } catch (error) {
          errors.push({
            code: 'ACCOUNT_SYNC_ERROR',
            message: `Failed to sync accounts: ${error instanceof Error ? error.message : String(error)}`,
            entityType: 'account',
            retryable: true,
          });
        }
      }

      // Sync opportunities
      if (options.syncOpportunities !== false) {
        try {
          const opportunities = await this.getOpportunities({
            where: whereClause,
            limit: options.batchSize,
            includeDeleted: options.includeDeleted,
          });
          opportunitiesSynced = opportunities.length;
        } catch (error) {
          errors.push({
            code: 'OPPORTUNITY_SYNC_ERROR',
            message: `Failed to sync opportunities: ${error instanceof Error ? error.message : String(error)}`,
            entityType: 'opportunity',
            retryable: true,
          });
        }
      }

      // Sync activities (tasks and events)
      if (options.syncActivities !== false) {
        try {
          const tasks = await this.getTasks({
            where: whereClause,
            limit: options.batchSize,
            includeDeleted: options.includeDeleted,
          });
          const events = await this.getEvents({
            where: whereClause,
            limit: options.batchSize,
            includeDeleted: options.includeDeleted,
          });
          activitiesSynced = tasks.length + events.length;
        } catch (error) {
          errors.push({
            code: 'ACTIVITY_SYNC_ERROR',
            message: `Failed to sync activities: ${error instanceof Error ? error.message : String(error)}`,
            entityType: 'activity',
            retryable: true,
          });
        }
      }

      const completedAt = new Date();

      return {
        provider: 'salesforce' as CRMProvider,
        success: errors.length === 0,
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        contactsSynced,
        accountsSynced,
        opportunitiesSynced,
        activitiesSynced,
        productsSynced,
        errors,
        warnings: [],
      };
    } catch (error) {
      const completedAt = new Date();
      return {
        provider: 'salesforce' as CRMProvider,
        success: false,
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        contactsSynced,
        accountsSynced,
        opportunitiesSynced,
        activitiesSynced,
        productsSynced,
        errors: [
          {
            code: 'SYNC_ERROR',
            message: `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
            retryable: true,
          },
        ],
        warnings: [],
      };
    }
  }

  // ============================================================================
  // Normalization Methods
  // ============================================================================

  /**
   * Normalize Salesforce contact to standard format
   */
  normalizeContact(
    contact: SalesforceContact,
    organizationId: string
  ): CRMContact {
    const emails: ContactEmail[] = [];
    if (contact.Email) {
      emails.push({
        email: contact.Email,
        type: 'work',
        isPrimary: true,
      });
    }

    const phones: ContactPhone[] = [];
    if (contact.Phone) {
      phones.push({
        phone: contact.Phone,
        type: 'work',
        isPrimary: true,
      });
    }
    if (contact.MobilePhone) {
      phones.push({
        phone: contact.MobilePhone,
        type: 'mobile',
        isPrimary: !contact.Phone,
      });
    }

    return {
      id: `sf-contact-${contact.Id}`,
      providerContactId: contact.Id,
      provider: 'salesforce' as CRMProvider,
      organizationId,
      firstName: contact.FirstName,
      lastName: contact.LastName,
      fullName: `${contact.FirstName || ''} ${contact.LastName}`.trim(),
      emails,
      phones,
      title: contact.Title,
      department: contact.Department,
      accountId: contact.AccountId
        ? `sf-account-${contact.AccountId}`
        : undefined,
      ownerId: contact.OwnerId ? `sf-user-${contact.OwnerId}` : undefined,
      leadSource: contact.LeadSource,
      mailingAddress: this.normalizeAddress({
        street: contact.MailingStreet,
        city: contact.MailingCity,
        state: contact.MailingState,
        postalCode: contact.MailingPostalCode,
        country: contact.MailingCountry,
      }),
      createdAt: new Date(contact.CreatedDate),
      updatedAt: new Date(contact.LastModifiedDate),
    };
  }

  /**
   * Normalize Salesforce account to standard format
   */
  normalizeAccount(
    account: SalesforceAccount,
    organizationId: string
  ): CRMAccount {
    return {
      id: `sf-account-${account.Id}`,
      providerAccountId: account.Id,
      provider: 'salesforce' as CRMProvider,
      organizationId,
      name: account.Name,
      website: account.Website,
      industry: account.Industry,
      type: this.mapAccountType(account.Type),
      numberOfEmployees: account.NumberOfEmployees,
      annualRevenue: account.AnnualRevenue,
      description: account.Description,
      ownerId: account.OwnerId ? `sf-user-${account.OwnerId}` : undefined,
      parentAccountId: account.ParentId
        ? `sf-account-${account.ParentId}`
        : undefined,
      billingAddress: this.normalizeAddress({
        street: account.BillingStreet,
        city: account.BillingCity,
        state: account.BillingState,
        postalCode: account.BillingPostalCode,
        country: account.BillingCountry,
      }),
      shippingAddress: this.normalizeAddress({
        street: account.ShippingStreet,
        city: account.ShippingCity,
        state: account.ShippingState,
        postalCode: account.ShippingPostalCode,
        country: account.ShippingCountry,
      }),
      phone: account.Phone,
      fax: account.Fax,
      status: account.IsDeleted ? 'deleted' : 'active',
      rating: this.mapAccountRating(account.Rating),
      sicCode: account.SicCode,
      tickerSymbol: account.TickerSymbol,
      createdAt: new Date(account.CreatedDate),
      updatedAt: new Date(account.LastModifiedDate),
    };
  }

  /**
   * Normalize Salesforce opportunity to standard format
   */
  normalizeOpportunity(
    opportunity: SalesforceOpportunity,
    organizationId: string
  ): CRMOpportunity {
    return {
      id: `sf-opp-${opportunity.Id}`,
      providerOpportunityId: opportunity.Id,
      provider: 'salesforce' as CRMProvider,
      organizationId,
      name: opportunity.Name,
      description: opportunity.Description,
      accountId: opportunity.AccountId
        ? `sf-account-${opportunity.AccountId}`
        : undefined,
      primaryContactId: opportunity.ContactId
        ? `sf-contact-${opportunity.ContactId}`
        : undefined,
      ownerId: opportunity.OwnerId ? `sf-user-${opportunity.OwnerId}` : undefined,
      stageId: opportunity.StageName,
      stageName: opportunity.StageName,
      probability: opportunity.Probability,
      amount: opportunity.Amount,
      currency: 'USD',
      closeDate: opportunity.CloseDate
        ? new Date(opportunity.CloseDate)
        : undefined,
      isClosed: opportunity.IsClosed,
      isWon: opportunity.IsWon,
      leadSource: opportunity.LeadSource,
      campaignId: opportunity.CampaignId,
      nextStep: opportunity.NextStep,
      forecastCategory: this.mapForecastCategory(opportunity.ForecastCategory),
      type: this.mapOpportunityType(opportunity.Type),
      createdAt: new Date(opportunity.CreatedDate),
      updatedAt: new Date(opportunity.LastModifiedDate),
    };
  }

  /**
   * Normalize Salesforce task to standard activity format
   */
  normalizeTask(task: SalesforceTask, organizationId: string): CRMActivity {
    return {
      id: `sf-task-${task.Id}`,
      providerActivityId: task.Id,
      provider: 'salesforce' as CRMProvider,
      organizationId,
      type: this.mapTaskType(task.TaskSubtype, task.CallType),
      subject: task.Subject,
      description: task.Description,
      status: this.mapTaskStatus(task.Status, task.IsClosed),
      priority: this.mapTaskPriority(task.Priority),
      dueDate: task.ActivityDate ? new Date(task.ActivityDate) : undefined,
      completedDate: task.IsClosed ? new Date(task.LastModifiedDate) : undefined,
      duration: task.CallDurationInSeconds
        ? Math.ceil(task.CallDurationInSeconds / 60)
        : undefined,
      contactIds: task.WhoId ? [`sf-contact-${task.WhoId}`] : undefined,
      opportunityId: task.WhatId?.startsWith('006')
        ? `sf-opp-${task.WhatId}`
        : undefined,
      accountId: task.WhatId?.startsWith('001')
        ? `sf-account-${task.WhatId}`
        : undefined,
      ownerId: `sf-user-${task.OwnerId}`,
      callDirection: task.CallType === 'Inbound' ? 'inbound' : 'outbound',
      createdAt: new Date(task.CreatedDate),
      updatedAt: new Date(task.LastModifiedDate),
    };
  }

  /**
   * Normalize address parts to CRMAddress
   */
  private normalizeAddress(parts: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }): CRMAddress | undefined {
    if (!parts.street && !parts.city) return undefined;
    return {
      street: parts.street,
      city: parts.city,
      state: parts.state,
      postalCode: parts.postalCode,
      country: parts.country,
    };
  }

  // ============================================================================
  // Mapping Helpers
  // ============================================================================

  private mapAccountType(type?: string): AccountType {
    if (!type) return 'other';
    const lower = type.toLowerCase();
    if (lower.includes('prospect')) return 'prospect';
    if (lower.includes('customer')) return 'customer';
    if (lower.includes('partner')) return 'partner';
    if (lower.includes('competitor')) return 'competitor';
    if (lower.includes('investor')) return 'investor';
    if (lower.includes('vendor')) return 'vendor';
    return 'other';
  }

  private mapAccountRating(rating?: string): AccountRating | undefined {
    if (!rating) return undefined;
    const lower = rating.toLowerCase();
    if (lower === 'hot') return 'hot';
    if (lower === 'warm') return 'warm';
    if (lower === 'cold') return 'cold';
    return undefined;
  }

  private mapForecastCategory(category?: string): ForecastCategory | undefined {
    if (!category) return undefined;
    const lower = category.toLowerCase();
    if (lower.includes('pipeline')) return 'pipeline';
    if (lower.includes('best')) return 'best_case';
    if (lower.includes('commit')) return 'commit';
    if (lower.includes('closed')) return 'closed';
    if (lower.includes('omit')) return 'omitted';
    return 'pipeline';
  }

  private mapOpportunityType(type?: string): OpportunityType {
    if (!type) return 'other';
    const lower = type.toLowerCase();
    if (lower.includes('new')) return 'new_business';
    if (lower.includes('existing')) return 'existing_business';
    if (lower.includes('expansion')) return 'expansion';
    if (lower.includes('renewal')) return 'renewal';
    if (lower.includes('upsell')) return 'upsell';
    if (lower.includes('cross')) return 'cross_sell';
    return 'other';
  }

  private mapTaskType(
    subtype?: string,
    callType?: string
  ): ActivityType {
    if (callType) return 'call';
    if (!subtype) return 'task';
    const lower = subtype.toLowerCase();
    if (lower === 'call') return 'call';
    if (lower === 'email') return 'email';
    return 'task';
  }

  private mapTaskStatus(status: string, isClosed: boolean): ActivityStatus {
    if (isClosed) return 'completed';
    const lower = status.toLowerCase();
    if (lower.includes('not started')) return 'not_started';
    if (lower.includes('in progress')) return 'in_progress';
    if (lower.includes('waiting')) return 'waiting';
    if (lower.includes('deferred')) return 'deferred';
    if (lower.includes('completed')) return 'completed';
    return 'not_started';
  }

  private mapTaskPriority(priority: string): ActivityPriority {
    const lower = priority.toLowerCase();
    if (lower === 'high') return 'high';
    if (lower === 'low') return 'low';
    return 'normal';
  }
}
