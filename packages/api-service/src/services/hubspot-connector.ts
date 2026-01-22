/**
 * HubSpot CRM Connector
 *
 * Integrates with HubSpot API v3 for CRM data synchronization.
 * Features:
 * - OAuth 2.0 and API key authentication
 * - Contact, Company, Deal sync
 * - Pipeline and stage management
 * - Activity/Engagement management
 * - Association handling
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
  CRMSyncOptions,
  CRMSyncResult,
  CRMSyncError,
  CRMAddress,
  ContactEmail,
  ContactPhone,
  LifecycleStage,
  AccountType,
  ForecastCategory,
  OpportunityType,
  ActivityType,
  ActivityStatus,
  ActivityPriority,
  HubSpotOAuthTokens,
  HubSpotResponse,
  HubSpotObject,
  HubSpotContactProperties,
  HubSpotCompanyProperties,
  HubSpotDealProperties,
  HubSpotPipeline,
  HubSpotPipelineStage,
} from '../types/crm.types';

// ============================================================================
// HubSpot-Specific Types
// ============================================================================

/**
 * HubSpot connector configuration
 */
export interface HubSpotConfig {
  /** OAuth access token */
  accessToken?: string;
  /** OAuth refresh token */
  refreshToken?: string;
  /** API key (legacy, deprecated by HubSpot) */
  apiKey?: string;
  /** OAuth client ID */
  clientId?: string;
  /** OAuth client secret */
  clientSecret?: string;
  /** Token expiration */
  expiresAt?: Date;
  /** Portal ID */
  portalId?: string;
}

/**
 * HubSpot search request
 */
export interface HubSpotSearchRequest {
  filterGroups?: Array<{
    filters: Array<{
      propertyName: string;
      operator: string;
      value?: string;
      values?: string[];
    }>;
  }>;
  sorts?: Array<{
    propertyName: string;
    direction: 'ASCENDING' | 'DESCENDING';
  }>;
  properties?: string[];
  limit?: number;
  after?: string;
}

/**
 * HubSpot engagement (activity)
 */
export interface HubSpotEngagement {
  id: string;
  properties: {
    hs_timestamp?: string;
    hs_activity_type?: string;
    hs_engagement_type?: string;
    hs_task_subject?: string;
    hs_task_body?: string;
    hs_task_status?: string;
    hs_task_priority?: string;
    hs_task_type?: string;
    hs_call_body?: string;
    hs_call_title?: string;
    hs_call_duration?: string;
    hs_call_direction?: string;
    hs_call_status?: string;
    hs_meeting_title?: string;
    hs_meeting_body?: string;
    hs_meeting_start_time?: string;
    hs_meeting_end_time?: string;
    hs_meeting_location?: string;
    hs_meeting_outcome?: string;
    hs_email_subject?: string;
    hs_email_text?: string;
    hs_email_status?: string;
    hs_email_direction?: string;
    hs_note_body?: string;
    hubspot_owner_id?: string;
  };
  createdAt: string;
  updatedAt: string;
  associations?: {
    contacts?: { results: Array<{ id: string }> };
    companies?: { results: Array<{ id: string }> };
    deals?: { results: Array<{ id: string }> };
  };
}

/**
 * HubSpot owner (user)
 */
export interface HubSpotOwner {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  userId?: number;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

// ============================================================================
// HubSpot Connector Implementation
// ============================================================================

/**
 * HubSpot CRM connector
 */
export class HubSpotConnector extends BaseConnector {
  private hsConfig: HubSpotConfig;
  private static readonly BASE_URL = 'https://api.hubapi.com';

  constructor(
    context: ConnectorServiceContext,
    hsConfig: HubSpotConfig,
    httpClient?: HttpClientInterface
  ) {
    const connectorConfig: ConnectorConfig = {
      id: `hubspot-${context.organizationId ?? 'default'}`,
      name: 'HubSpot CRM',
      type: 'hubspot',
      baseUrl: HubSpotConnector.BASE_URL,
      credentials: hsConfig.apiKey
        ? {
            method: 'bearer',
            token: hsConfig.apiKey,
          }
        : {
            method: 'oauth2',
            grantType: 'refresh_token',
            clientId: hsConfig.clientId ?? '',
            clientSecret: hsConfig.clientSecret ?? '',
            accessToken: hsConfig.accessToken,
            refreshToken: hsConfig.refreshToken,
            expiresAt: hsConfig.expiresAt,
            tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
          },
      rateLimit: {
        // HubSpot has generous rate limits (100 requests/10 seconds for private apps)
        maxRequests: 100,
        window: 'second',
        windowMs: 10000,
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
    this.hsConfig = hsConfig;
  }

  /**
   * Test connection to HubSpot
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      // Try to get account info
      const response = await this.get<{
        portalId: number;
        uiDomain: string;
        dataHostingLocation: string;
      }>('/account-info/v3/details');

      return {
        success: true,
        latencyMs: Date.now() - startTime,
        message: 'Successfully connected to HubSpot',
        details: {
          portalId: response.data.portalId,
          domain: response.data.uiDomain,
        },
      };
    } catch (error) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: `Failed to connect to HubSpot: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ============================================================================
  // Contact Methods
  // ============================================================================

  /**
   * Get contacts
   */
  async getContacts(options: {
    properties?: string[];
    limit?: number;
    after?: string;
    archived?: boolean;
  } = {}): Promise<HubSpotResponse<HubSpotObject>> {
    const properties = options.properties || [
      'email',
      'firstname',
      'lastname',
      'phone',
      'mobilephone',
      'jobtitle',
      'company',
      'address',
      'city',
      'state',
      'zip',
      'country',
      'website',
      'lifecyclestage',
      'hs_lead_status',
      'hubspot_owner_id',
    ];

    const params = new URLSearchParams();
    params.append('properties', properties.join(','));
    if (options.limit) params.append('limit', String(options.limit));
    if (options.after) params.append('after', options.after);
    if (options.archived !== undefined)
      params.append('archived', String(options.archived));

    const response = await this.get<HubSpotResponse<HubSpotObject>>(
      `/crm/v3/objects/contacts?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Get all contacts with pagination
   */
  async getAllContacts(
    properties?: string[],
    limit: number = 100
  ): Promise<HubSpotObject[]> {
    const contacts: HubSpotObject[] = [];
    let after: string | undefined;

    do {
      const response = await this.getContacts({
        properties,
        limit,
        after,
      });
      contacts.push(...response.results);
      after = response.paging?.next?.after;
    } while (after);

    return contacts;
  }

  /**
   * Get single contact
   */
  async getContact(
    contactId: string,
    properties?: string[]
  ): Promise<HubSpotObject> {
    const defaultProps = [
      'email',
      'firstname',
      'lastname',
      'phone',
      'mobilephone',
      'jobtitle',
      'company',
      'lifecyclestage',
      'hs_lead_status',
      'hubspot_owner_id',
    ];
    const props = properties || defaultProps;

    const response = await this.get<HubSpotObject>(
      `/crm/v3/objects/contacts/${contactId}?properties=${props.join(',')}`
    );
    return response.data;
  }

  /**
   * Search contacts
   */
  async searchContacts(
    searchRequest: HubSpotSearchRequest
  ): Promise<HubSpotResponse<HubSpotObject>> {
    const response = await this.post<HubSpotResponse<HubSpotObject>>(
      '/crm/v3/objects/contacts/search',
      searchRequest
    );
    return response.data;
  }

  /**
   * Create contact
   */
  async createContact(
    properties: Partial<HubSpotContactProperties>
  ): Promise<HubSpotObject> {
    const response = await this.post<HubSpotObject>('/crm/v3/objects/contacts', {
      properties,
    });
    return response.data;
  }

  /**
   * Update contact
   */
  async updateContact(
    contactId: string,
    properties: Partial<HubSpotContactProperties>
  ): Promise<HubSpotObject> {
    const response = await this.patch<HubSpotObject>(
      `/crm/v3/objects/contacts/${contactId}`,
      { properties }
    );
    return response.data;
  }

  // ============================================================================
  // Company Methods
  // ============================================================================

  /**
   * Get companies
   */
  async getCompanies(options: {
    properties?: string[];
    limit?: number;
    after?: string;
    archived?: boolean;
  } = {}): Promise<HubSpotResponse<HubSpotObject>> {
    const properties = options.properties || [
      'name',
      'domain',
      'website',
      'phone',
      'industry',
      'type',
      'description',
      'numberofemployees',
      'annualrevenue',
      'address',
      'city',
      'state',
      'zip',
      'country',
      'hubspot_owner_id',
    ];

    const params = new URLSearchParams();
    params.append('properties', properties.join(','));
    if (options.limit) params.append('limit', String(options.limit));
    if (options.after) params.append('after', options.after);
    if (options.archived !== undefined)
      params.append('archived', String(options.archived));

    const response = await this.get<HubSpotResponse<HubSpotObject>>(
      `/crm/v3/objects/companies?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Get all companies with pagination
   */
  async getAllCompanies(
    properties?: string[],
    limit: number = 100
  ): Promise<HubSpotObject[]> {
    const companies: HubSpotObject[] = [];
    let after: string | undefined;

    do {
      const response = await this.getCompanies({
        properties,
        limit,
        after,
      });
      companies.push(...response.results);
      after = response.paging?.next?.after;
    } while (after);

    return companies;
  }

  /**
   * Get single company
   */
  async getCompany(
    companyId: string,
    properties?: string[]
  ): Promise<HubSpotObject> {
    const defaultProps = [
      'name',
      'domain',
      'website',
      'phone',
      'industry',
      'type',
      'numberofemployees',
      'annualrevenue',
      'hubspot_owner_id',
    ];
    const props = properties || defaultProps;

    const response = await this.get<HubSpotObject>(
      `/crm/v3/objects/companies/${companyId}?properties=${props.join(',')}`
    );
    return response.data;
  }

  /**
   * Create company
   */
  async createCompany(
    properties: Partial<HubSpotCompanyProperties>
  ): Promise<HubSpotObject> {
    const response = await this.post<HubSpotObject>('/crm/v3/objects/companies', {
      properties,
    });
    return response.data;
  }

  /**
   * Update company
   */
  async updateCompany(
    companyId: string,
    properties: Partial<HubSpotCompanyProperties>
  ): Promise<HubSpotObject> {
    const response = await this.patch<HubSpotObject>(
      `/crm/v3/objects/companies/${companyId}`,
      { properties }
    );
    return response.data;
  }

  // ============================================================================
  // Deal Methods
  // ============================================================================

  /**
   * Get deals
   */
  async getDeals(options: {
    properties?: string[];
    limit?: number;
    after?: string;
    archived?: boolean;
  } = {}): Promise<HubSpotResponse<HubSpotObject>> {
    const properties = options.properties || [
      'dealname',
      'amount',
      'closedate',
      'dealstage',
      'pipeline',
      'hubspot_owner_id',
      'dealtype',
      'description',
      'hs_is_closed',
      'hs_is_closed_won',
      'hs_closed_amount',
      'hs_forecast_category',
    ];

    const params = new URLSearchParams();
    params.append('properties', properties.join(','));
    if (options.limit) params.append('limit', String(options.limit));
    if (options.after) params.append('after', options.after);
    if (options.archived !== undefined)
      params.append('archived', String(options.archived));

    const response = await this.get<HubSpotResponse<HubSpotObject>>(
      `/crm/v3/objects/deals?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Get all deals with pagination
   */
  async getAllDeals(
    properties?: string[],
    limit: number = 100
  ): Promise<HubSpotObject[]> {
    const deals: HubSpotObject[] = [];
    let after: string | undefined;

    do {
      const response = await this.getDeals({
        properties,
        limit,
        after,
      });
      deals.push(...response.results);
      after = response.paging?.next?.after;
    } while (after);

    return deals;
  }

  /**
   * Get single deal
   */
  async getDeal(dealId: string, properties?: string[]): Promise<HubSpotObject> {
    const defaultProps = [
      'dealname',
      'amount',
      'closedate',
      'dealstage',
      'pipeline',
      'hubspot_owner_id',
      'hs_is_closed',
      'hs_is_closed_won',
    ];
    const props = properties || defaultProps;

    const response = await this.get<HubSpotObject>(
      `/crm/v3/objects/deals/${dealId}?properties=${props.join(',')}`
    );
    return response.data;
  }

  /**
   * Create deal
   */
  async createDeal(
    properties: Partial<HubSpotDealProperties>
  ): Promise<HubSpotObject> {
    const response = await this.post<HubSpotObject>('/crm/v3/objects/deals', {
      properties,
    });
    return response.data;
  }

  /**
   * Update deal
   */
  async updateDeal(
    dealId: string,
    properties: Partial<HubSpotDealProperties>
  ): Promise<HubSpotObject> {
    const response = await this.patch<HubSpotObject>(
      `/crm/v3/objects/deals/${dealId}`,
      { properties }
    );
    return response.data;
  }

  // ============================================================================
  // Pipeline Methods
  // ============================================================================

  /**
   * Get all pipelines for an object type
   */
  async getPipelines(objectType: 'deals' | 'tickets'): Promise<HubSpotPipeline[]> {
    const response = await this.get<{ results: HubSpotPipeline[] }>(
      `/crm/v3/pipelines/${objectType}`
    );
    return response.data.results;
  }

  /**
   * Get deal pipelines
   */
  async getDealPipelines(): Promise<CRMPipeline[]> {
    const pipelines = await this.getPipelines('deals');
    return pipelines.map((p) => this.normalizePipeline(p));
  }

  // ============================================================================
  // Engagement/Activity Methods
  // ============================================================================

  /**
   * Get engagements (activities)
   */
  async getEngagements(
    objectType: 'tasks' | 'calls' | 'meetings' | 'emails' | 'notes',
    options: {
      limit?: number;
      after?: string;
    } = {}
  ): Promise<HubSpotResponse<HubSpotEngagement>> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', String(options.limit));
    if (options.after) params.append('after', options.after);

    const response = await this.get<HubSpotResponse<HubSpotEngagement>>(
      `/crm/v3/objects/${objectType}?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Get tasks
   */
  async getTasks(options: { limit?: number; after?: string } = {}): Promise<
    HubSpotResponse<HubSpotEngagement>
  > {
    return this.getEngagements('tasks', options);
  }

  /**
   * Get calls
   */
  async getCalls(options: { limit?: number; after?: string } = {}): Promise<
    HubSpotResponse<HubSpotEngagement>
  > {
    return this.getEngagements('calls', options);
  }

  /**
   * Get meetings
   */
  async getMeetings(options: { limit?: number; after?: string } = {}): Promise<
    HubSpotResponse<HubSpotEngagement>
  > {
    return this.getEngagements('meetings', options);
  }

  /**
   * Create task
   */
  async createTask(properties: {
    hs_task_subject: string;
    hs_task_body?: string;
    hs_task_status?: string;
    hs_task_priority?: string;
    hs_timestamp?: string;
    hubspot_owner_id?: string;
  }): Promise<HubSpotEngagement> {
    const response = await this.post<HubSpotEngagement>(
      '/crm/v3/objects/tasks',
      { properties }
    );
    return response.data;
  }

  // ============================================================================
  // Owner Methods
  // ============================================================================

  /**
   * Get owners (users)
   */
  async getOwners(options: {
    email?: string;
    limit?: number;
    after?: string;
  } = {}): Promise<HubSpotResponse<HubSpotOwner>> {
    const params = new URLSearchParams();
    if (options.email) params.append('email', options.email);
    if (options.limit) params.append('limit', String(options.limit));
    if (options.after) params.append('after', options.after);

    const response = await this.get<HubSpotResponse<HubSpotOwner>>(
      `/crm/v3/owners?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Get all owners
   */
  async getAllOwners(): Promise<HubSpotOwner[]> {
    const owners: HubSpotOwner[] = [];
    let after: string | undefined;

    do {
      const response = await this.getOwners({ limit: 100, after });
      owners.push(...response.results);
      after = response.paging?.next?.after;
    } while (after);

    return owners;
  }

  // ============================================================================
  // Association Methods
  // ============================================================================

  /**
   * Get associations for an object
   */
  async getAssociations(
    fromObjectType: string,
    fromObjectId: string,
    toObjectType: string
  ): Promise<Array<{ id: string; type: string }>> {
    const response = await this.get<{
      results: Array<{ id: string; type: string }>;
    }>(
      `/crm/v3/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}`
    );
    return response.data.results;
  }

  /**
   * Create association between objects
   */
  async createAssociation(
    fromObjectType: string,
    fromObjectId: string,
    toObjectType: string,
    toObjectId: string,
    associationType: string
  ): Promise<void> {
    await this.put(
      `/crm/v3/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}/${toObjectId}/${associationType}`,
      {}
    );
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

    try {
      // Sync contacts
      if (options.syncContacts !== false) {
        try {
          const contacts = await this.getAllContacts(
            undefined,
            options.batchSize || 100
          );
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

      // Sync companies (accounts)
      if (options.syncAccounts !== false) {
        try {
          const companies = await this.getAllCompanies(
            undefined,
            options.batchSize || 100
          );
          accountsSynced = companies.length;
        } catch (error) {
          errors.push({
            code: 'ACCOUNT_SYNC_ERROR',
            message: `Failed to sync companies: ${error instanceof Error ? error.message : String(error)}`,
            entityType: 'account',
            retryable: true,
          });
        }
      }

      // Sync deals (opportunities)
      if (options.syncOpportunities !== false) {
        try {
          const deals = await this.getAllDeals(
            undefined,
            options.batchSize || 100
          );
          opportunitiesSynced = deals.length;
        } catch (error) {
          errors.push({
            code: 'OPPORTUNITY_SYNC_ERROR',
            message: `Failed to sync deals: ${error instanceof Error ? error.message : String(error)}`,
            entityType: 'opportunity',
            retryable: true,
          });
        }
      }

      // Sync activities
      if (options.syncActivities !== false) {
        try {
          const tasks = await this.getEngagements('tasks', {
            limit: options.batchSize || 100,
          });
          const calls = await this.getEngagements('calls', {
            limit: options.batchSize || 100,
          });
          const meetings = await this.getEngagements('meetings', {
            limit: options.batchSize || 100,
          });
          activitiesSynced =
            tasks.results.length + calls.results.length + meetings.results.length;
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
        provider: 'hubspot' as CRMProvider,
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
        provider: 'hubspot' as CRMProvider,
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
   * Normalize HubSpot contact to standard format
   */
  normalizeContact(contact: HubSpotObject, organizationId: string): CRMContact {
    const props = contact.properties as HubSpotContactProperties;

    const emails: ContactEmail[] = [];
    if (props.email) {
      emails.push({
        email: props.email,
        type: 'work',
        isPrimary: true,
      });
    }

    const phones: ContactPhone[] = [];
    if (props.phone) {
      phones.push({
        phone: props.phone,
        type: 'work',
        isPrimary: true,
      });
    }
    if (props.mobilephone) {
      phones.push({
        phone: props.mobilephone,
        type: 'mobile',
        isPrimary: !props.phone,
      });
    }

    return {
      id: `hs-contact-${contact.id}`,
      providerContactId: contact.id,
      provider: 'hubspot' as CRMProvider,
      organizationId,
      firstName: props.firstname,
      lastName: props.lastname,
      fullName: `${props.firstname || ''} ${props.lastname || ''}`.trim(),
      emails,
      phones,
      title: props.jobtitle,
      lifecycleStage: this.mapLifecycleStage(props.lifecyclestage),
      leadStatus: props.hs_lead_status as any,
      ownerId: props.hubspot_owner_id
        ? `hs-owner-${props.hubspot_owner_id}`
        : undefined,
      mailingAddress: this.normalizeAddress({
        street: props.address,
        city: props.city,
        state: props.state,
        postalCode: props.zip,
        country: props.country,
      }),
      createdAt: new Date(contact.createdAt),
      updatedAt: new Date(contact.updatedAt),
    };
  }

  /**
   * Normalize HubSpot company to standard account format
   */
  normalizeCompany(company: HubSpotObject, organizationId: string): CRMAccount {
    const props = company.properties as HubSpotCompanyProperties;

    return {
      id: `hs-company-${company.id}`,
      providerAccountId: company.id,
      provider: 'hubspot' as CRMProvider,
      organizationId,
      name: props.name || '',
      domain: props.domain,
      website: props.website,
      industry: props.industry,
      type: this.mapAccountType(props.type),
      numberOfEmployees: props.numberofemployees
        ? parseInt(props.numberofemployees, 10)
        : undefined,
      annualRevenue: props.annualrevenue
        ? parseFloat(props.annualrevenue)
        : undefined,
      description: props.description,
      ownerId: props.hubspot_owner_id
        ? `hs-owner-${props.hubspot_owner_id}`
        : undefined,
      billingAddress: this.normalizeAddress({
        street: props.address,
        city: props.city,
        state: props.state,
        postalCode: props.zip,
        country: props.country,
      }),
      phone: props.phone,
      status: company.archived ? 'archived' : 'active',
      createdAt: new Date(company.createdAt),
      updatedAt: new Date(company.updatedAt),
    };
  }

  /**
   * Normalize HubSpot deal to standard opportunity format
   */
  normalizeDeal(deal: HubSpotObject, organizationId: string): CRMOpportunity {
    const props = deal.properties as HubSpotDealProperties;

    return {
      id: `hs-deal-${deal.id}`,
      providerOpportunityId: deal.id,
      provider: 'hubspot' as CRMProvider,
      organizationId,
      name: props.dealname || '',
      description: props.description,
      pipelineId: props.pipeline,
      stageId: props.dealstage || '',
      stageName: props.dealstage || '',
      amount: props.amount ? parseFloat(props.amount) : undefined,
      currency: 'USD',
      closeDate: props.closedate ? new Date(props.closedate) : undefined,
      isClosed: props.hs_is_closed === 'true',
      isWon: props.hs_is_closed_won === 'true',
      ownerId: props.hubspot_owner_id
        ? `hs-owner-${props.hubspot_owner_id}`
        : undefined,
      type: this.mapDealType(props.dealtype),
      forecastCategory: this.mapForecastCategory(props.hs_forecast_category),
      createdAt: new Date(deal.createdAt),
      updatedAt: new Date(deal.updatedAt),
    };
  }

  /**
   * Normalize HubSpot pipeline to standard format
   */
  normalizePipeline(pipeline: HubSpotPipeline): CRMPipeline {
    return {
      id: `hs-pipeline-${pipeline.id}`,
      providerPipelineId: pipeline.id,
      provider: 'hubspot' as CRMProvider,
      organizationId: '', // Set externally
      name: pipeline.label,
      isDefault: pipeline.displayOrder === 0,
      stages: pipeline.stages.map((s) => this.normalizeStage(s)),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Normalize HubSpot pipeline stage
   */
  private normalizeStage(stage: HubSpotPipelineStage): PipelineStage {
    const isClosed = stage.metadata.isClosed === 'true';
    const probability = parseFloat(stage.metadata.probability) || 0;

    return {
      id: `hs-stage-${stage.id}`,
      providerStageId: stage.id,
      name: stage.label,
      displayOrder: stage.displayOrder,
      probability,
      isClosed,
      isWon: isClosed && probability >= 1,
      type: isClosed ? (probability >= 1 ? 'won' : 'lost') : 'open',
    };
  }

  /**
   * Normalize HubSpot engagement to standard activity format
   */
  normalizeEngagement(
    engagement: HubSpotEngagement,
    activityType: ActivityType,
    organizationId: string
  ): CRMActivity {
    const props = engagement.properties;

    let subject = '';
    let description = '';
    let status: ActivityStatus = 'completed';
    let priority: ActivityPriority = 'normal';
    let duration: number | undefined;

    switch (activityType) {
      case 'task':
        subject = props.hs_task_subject || '';
        description = props.hs_task_body || '';
        status = this.mapTaskStatus(props.hs_task_status);
        priority = this.mapTaskPriority(props.hs_task_priority);
        break;
      case 'call':
        subject = props.hs_call_title || 'Call';
        description = props.hs_call_body || '';
        duration = props.hs_call_duration
          ? Math.ceil(parseInt(props.hs_call_duration, 10) / 60000)
          : undefined;
        break;
      case 'meeting':
        subject = props.hs_meeting_title || 'Meeting';
        description = props.hs_meeting_body || '';
        break;
      case 'email':
        subject = props.hs_email_subject || 'Email';
        description = props.hs_email_text || '';
        break;
      case 'note':
        subject = 'Note';
        description = props.hs_note_body || '';
        break;
    }

    const contactIds = engagement.associations?.contacts?.results.map(
      (c) => `hs-contact-${c.id}`
    );
    const companyIds = engagement.associations?.companies?.results.map(
      (c) => `hs-company-${c.id}`
    );
    const dealIds = engagement.associations?.deals?.results.map(
      (d) => `hs-deal-${d.id}`
    );

    return {
      id: `hs-${activityType}-${engagement.id}`,
      providerActivityId: engagement.id,
      provider: 'hubspot' as CRMProvider,
      organizationId,
      type: activityType,
      subject,
      description,
      status,
      priority,
      duration,
      contactIds,
      accountId: companyIds?.[0],
      opportunityId: dealIds?.[0],
      ownerId: props.hubspot_owner_id
        ? `hs-owner-${props.hubspot_owner_id}`
        : undefined,
      callDirection:
        props.hs_call_direction === 'INBOUND' ? 'inbound' : 'outbound',
      location: props.hs_meeting_location,
      createdAt: new Date(engagement.createdAt),
      updatedAt: new Date(engagement.updatedAt),
    };
  }

  /**
   * Normalize address
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

  private mapLifecycleStage(stage?: string): LifecycleStage | undefined {
    if (!stage) return undefined;
    const lower = stage.toLowerCase();
    if (lower === 'subscriber') return 'subscriber';
    if (lower === 'lead') return 'lead';
    if (lower === 'marketingqualifiedlead') return 'marketing_qualified_lead';
    if (lower === 'salesqualifiedlead') return 'sales_qualified_lead';
    if (lower === 'opportunity') return 'opportunity';
    if (lower === 'customer') return 'customer';
    if (lower === 'evangelist') return 'evangelist';
    return 'other';
  }

  private mapAccountType(type?: string): AccountType {
    if (!type) return 'other';
    const lower = type.toLowerCase();
    if (lower.includes('prospect')) return 'prospect';
    if (lower.includes('customer')) return 'customer';
    if (lower.includes('partner')) return 'partner';
    if (lower.includes('competitor')) return 'competitor';
    if (lower.includes('vendor')) return 'vendor';
    return 'other';
  }

  private mapDealType(type?: string): OpportunityType {
    if (!type) return 'other';
    const lower = type.toLowerCase();
    if (lower.includes('new')) return 'new_business';
    if (lower.includes('existing')) return 'existing_business';
    if (lower.includes('renewal')) return 'renewal';
    return 'other';
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

  private mapTaskStatus(status?: string): ActivityStatus {
    if (!status) return 'not_started';
    const lower = status.toLowerCase();
    if (lower === 'not_started') return 'not_started';
    if (lower === 'in_progress') return 'in_progress';
    if (lower === 'waiting') return 'waiting';
    if (lower === 'completed') return 'completed';
    if (lower === 'deferred') return 'deferred';
    return 'not_started';
  }

  private mapTaskPriority(priority?: string): ActivityPriority {
    if (!priority) return 'normal';
    const lower = priority.toLowerCase();
    if (lower === 'high') return 'high';
    if (lower === 'low') return 'low';
    return 'normal';
  }
}
