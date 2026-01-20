/**
 * CRM Integration Types
 *
 * Type definitions for CRM system integrations (Salesforce, HubSpot)
 * Provides normalized types for contacts, accounts, opportunities, and deals.
 */

// ============================================================================
// Common CRM Types
// ============================================================================

/**
 * CRM provider types
 */
export type CRMProvider = 'salesforce' | 'hubspot' | 'pipedrive' | 'zoho';

/**
 * Entity status
 */
export type CRMEntityStatus = 'active' | 'inactive' | 'archived' | 'deleted';

/**
 * Currency code (ISO 4217)
 */
export type CurrencyCode = string;

// ============================================================================
// Normalized Contact Types
// ============================================================================

/**
 * Normalized contact information
 */
export interface CRMContact {
  /** Internal ID */
  id: string;
  /** Provider-specific contact ID */
  providerContactId: string;
  /** CRM provider */
  provider: CRMProvider;
  /** Organization ID */
  organizationId: string;
  /** First name */
  firstName?: string;
  /** Last name */
  lastName?: string;
  /** Full name */
  fullName: string;
  /** Email addresses */
  emails: ContactEmail[];
  /** Phone numbers */
  phones: ContactPhone[];
  /** Job title */
  title?: string;
  /** Department */
  department?: string;
  /** Associated account/company ID */
  accountId?: string;
  /** Owner user ID */
  ownerId?: string;
  /** Lead source */
  leadSource?: string;
  /** Lead status */
  leadStatus?: LeadStatus;
  /** Lifecycle stage */
  lifecycleStage?: LifecycleStage;
  /** Mailing address */
  mailingAddress?: CRMAddress;
  /** Social profiles */
  socialProfiles?: SocialProfile[];
  /** Custom fields */
  customFields?: Record<string, unknown>;
  /** Tags/labels */
  tags?: string[];
  /** Last activity date */
  lastActivityDate?: Date;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Contact email entry
 */
export interface ContactEmail {
  email: string;
  type: 'work' | 'personal' | 'other';
  isPrimary: boolean;
  isVerified?: boolean;
}

/**
 * Contact phone entry
 */
export interface ContactPhone {
  phone: string;
  type: 'work' | 'mobile' | 'home' | 'fax' | 'other';
  isPrimary: boolean;
}

/**
 * Lead status
 */
export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'unqualified'
  | 'nurturing'
  | 'converted';

/**
 * Lifecycle stage
 */
export type LifecycleStage =
  | 'subscriber'
  | 'lead'
  | 'marketing_qualified_lead'
  | 'sales_qualified_lead'
  | 'opportunity'
  | 'customer'
  | 'evangelist'
  | 'other';

/**
 * Address
 */
export interface CRMAddress {
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Social profile
 */
export interface SocialProfile {
  platform: 'linkedin' | 'twitter' | 'facebook' | 'github' | 'other';
  url?: string;
  username?: string;
}

// ============================================================================
// Normalized Account/Company Types
// ============================================================================

/**
 * Normalized account/company information
 */
export interface CRMAccount {
  /** Internal ID */
  id: string;
  /** Provider-specific account ID */
  providerAccountId: string;
  /** CRM provider */
  provider: CRMProvider;
  /** Organization ID */
  organizationId: string;
  /** Company name */
  name: string;
  /** Company domain */
  domain?: string;
  /** Company website */
  website?: string;
  /** Industry */
  industry?: string;
  /** Company type */
  type?: AccountType;
  /** Number of employees */
  numberOfEmployees?: number;
  /** Employee range */
  employeeRange?: string;
  /** Annual revenue */
  annualRevenue?: number;
  /** Revenue currency */
  currency?: CurrencyCode;
  /** Description */
  description?: string;
  /** Owner user ID */
  ownerId?: string;
  /** Parent account ID */
  parentAccountId?: string;
  /** Billing address */
  billingAddress?: CRMAddress;
  /** Shipping address */
  shippingAddress?: CRMAddress;
  /** Phone */
  phone?: string;
  /** Fax */
  fax?: string;
  /** Account status */
  status: CRMEntityStatus;
  /** Customer tier */
  tier?: CustomerTier;
  /** Rating */
  rating?: AccountRating;
  /** SIC code */
  sicCode?: string;
  /** NAICS code */
  naicsCode?: string;
  /** Ticker symbol */
  tickerSymbol?: string;
  /** Linked GL customer ID */
  glCustomerId?: string;
  /** Custom fields */
  customFields?: Record<string, unknown>;
  /** Tags/labels */
  tags?: string[];
  /** Last activity date */
  lastActivityDate?: Date;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Account type
 */
export type AccountType =
  | 'prospect'
  | 'customer'
  | 'partner'
  | 'competitor'
  | 'investor'
  | 'vendor'
  | 'other';

/**
 * Customer tier
 */
export type CustomerTier = 'enterprise' | 'mid_market' | 'smb' | 'startup' | 'other';

/**
 * Account rating
 */
export type AccountRating = 'hot' | 'warm' | 'cold';

// ============================================================================
// Normalized Opportunity/Deal Types
// ============================================================================

/**
 * Normalized opportunity/deal information
 */
export interface CRMOpportunity {
  /** Internal ID */
  id: string;
  /** Provider-specific opportunity ID */
  providerOpportunityId: string;
  /** CRM provider */
  provider: CRMProvider;
  /** Organization ID */
  organizationId: string;
  /** Opportunity name */
  name: string;
  /** Description */
  description?: string;
  /** Associated account ID */
  accountId?: string;
  /** Account name */
  accountName?: string;
  /** Primary contact ID */
  primaryContactId?: string;
  /** All associated contacts */
  contactIds?: string[];
  /** Owner user ID */
  ownerId?: string;
  /** Pipeline ID */
  pipelineId?: string;
  /** Pipeline name */
  pipelineName?: string;
  /** Stage ID */
  stageId: string;
  /** Stage name */
  stageName: string;
  /** Stage probability (0-100) */
  probability?: number;
  /** Amount */
  amount?: number;
  /** Currency */
  currency?: CurrencyCode;
  /** Close date */
  closeDate?: Date;
  /** Is closed */
  isClosed: boolean;
  /** Is won */
  isWon: boolean;
  /** Loss reason */
  lossReason?: string;
  /** Win reason */
  winReason?: string;
  /** Lead source */
  leadSource?: string;
  /** Campaign ID */
  campaignId?: string;
  /** Next step */
  nextStep?: string;
  /** Forecast category */
  forecastCategory?: ForecastCategory;
  /** Type */
  type?: OpportunityType;
  /** Products/line items */
  lineItems?: OpportunityLineItem[];
  /** Custom fields */
  customFields?: Record<string, unknown>;
  /** Tags/labels */
  tags?: string[];
  /** Last activity date */
  lastActivityDate?: Date;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Forecast category
 */
export type ForecastCategory =
  | 'pipeline'
  | 'best_case'
  | 'commit'
  | 'closed'
  | 'omitted';

/**
 * Opportunity type
 */
export type OpportunityType =
  | 'new_business'
  | 'existing_business'
  | 'expansion'
  | 'renewal'
  | 'upsell'
  | 'cross_sell'
  | 'other';

/**
 * Opportunity line item
 */
export interface OpportunityLineItem {
  id: string;
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  discountType?: 'percentage' | 'amount';
  totalPrice: number;
  currency?: CurrencyCode;
}

// ============================================================================
// Pipeline Types
// ============================================================================

/**
 * Sales pipeline
 */
export interface CRMPipeline {
  id: string;
  providerPipelineId: string;
  provider: CRMProvider;
  organizationId: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
  currency?: CurrencyCode;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Pipeline stage
 */
export interface PipelineStage {
  id: string;
  providerStageId: string;
  name: string;
  displayOrder: number;
  probability: number;
  isClosed: boolean;
  isWon: boolean;
  type: 'open' | 'won' | 'lost';
}

// ============================================================================
// Activity Types
// ============================================================================

/**
 * CRM activity (task, call, meeting, email)
 */
export interface CRMActivity {
  id: string;
  providerActivityId: string;
  provider: CRMProvider;
  organizationId: string;
  type: ActivityType;
  subject: string;
  description?: string;
  status: ActivityStatus;
  priority?: ActivityPriority;
  dueDate?: Date;
  completedDate?: Date;
  /** Duration in minutes */
  duration?: number;
  /** Associated contact IDs */
  contactIds?: string[];
  /** Associated account ID */
  accountId?: string;
  /** Associated opportunity ID */
  opportunityId?: string;
  /** Owner user ID */
  ownerId?: string;
  /** Assigned to user ID */
  assignedToId?: string;
  /** Outcome/result */
  outcome?: string;
  /** Call direction */
  callDirection?: 'inbound' | 'outbound';
  /** Meeting attendees */
  attendees?: ActivityAttendee[];
  /** Location */
  location?: string;
  /** Video conference URL */
  conferenceUrl?: string;
  /** Custom fields */
  customFields?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Activity type
 */
export type ActivityType =
  | 'task'
  | 'call'
  | 'meeting'
  | 'email'
  | 'note'
  | 'other';

/**
 * Activity status
 */
export type ActivityStatus =
  | 'not_started'
  | 'in_progress'
  | 'waiting'
  | 'completed'
  | 'deferred'
  | 'cancelled';

/**
 * Activity priority
 */
export type ActivityPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Activity attendee
 */
export interface ActivityAttendee {
  name?: string;
  email?: string;
  contactId?: string;
  responseStatus?: 'accepted' | 'declined' | 'tentative' | 'none';
  isOrganizer?: boolean;
}

// ============================================================================
// Product/Price Book Types
// ============================================================================

/**
 * CRM product
 */
export interface CRMProduct {
  id: string;
  providerProductId: string;
  provider: CRMProvider;
  organizationId: string;
  name: string;
  productCode?: string;
  description?: string;
  isActive: boolean;
  family?: string;
  unitPrice?: number;
  currency?: CurrencyCode;
  /** Linked GL revenue account */
  glRevenueAccountId?: string;
  customFields?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// User Types
// ============================================================================

/**
 * CRM user
 */
export interface CRMUser {
  id: string;
  providerUserId: string;
  provider: CRMProvider;
  organizationId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  isActive: boolean;
  role?: string;
  profileId?: string;
  managerId?: string;
  timezone?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// GL Mapping Types
// ============================================================================

/**
 * CRM to GL mapping configuration
 */
export interface CRMGLMappingConfig {
  organizationId: string;
  /** Map CRM accounts to GL customers */
  autoCreateGLCustomers: boolean;
  /** Map closed-won opportunities to revenue */
  syncClosedWonToRevenue: boolean;
  /** Default revenue account for won deals */
  defaultRevenueAccountId?: string;
  /** Default AR account */
  defaultARAccountId?: string;
  /** Product to GL account mappings */
  productMappings: ProductGLMapping[];
  /** Account type to GL customer segment mappings */
  accountTypeMappings: AccountTypeMapping[];
}

/**
 * Product to GL account mapping
 */
export interface ProductGLMapping {
  crmProductId: string;
  glRevenueAccountId: string;
  glDeferredRevenueAccountId?: string;
}

/**
 * Account type to customer segment mapping
 */
export interface AccountTypeMapping {
  accountType: AccountType;
  tier?: CustomerTier;
  glCustomerSegment?: string;
  glDepartmentId?: string;
}

// ============================================================================
// Sync Types
// ============================================================================

/**
 * CRM sync options
 */
export interface CRMSyncOptions {
  /** Sync contacts */
  syncContacts?: boolean;
  /** Sync accounts */
  syncAccounts?: boolean;
  /** Sync opportunities */
  syncOpportunities?: boolean;
  /** Sync activities */
  syncActivities?: boolean;
  /** Sync products */
  syncProducts?: boolean;
  /** Start date for incremental sync */
  modifiedSince?: Date;
  /** Include deleted records */
  includeDeleted?: boolean;
  /** Force full refresh */
  forceFullRefresh?: boolean;
  /** Batch size */
  batchSize?: number;
}

/**
 * CRM sync result
 */
export interface CRMSyncResult {
  provider: CRMProvider;
  success: boolean;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  contactsSynced: number;
  accountsSynced: number;
  opportunitiesSynced: number;
  activitiesSynced: number;
  productsSynced: number;
  errors: CRMSyncError[];
  warnings: CRMSyncWarning[];
  /** Next sync cursor */
  cursor?: CRMSyncCursor;
}

/**
 * CRM sync cursor for incremental sync
 */
export interface CRMSyncCursor {
  lastSyncedAt: Date;
  contactsCursor?: string;
  accountsCursor?: string;
  opportunitiesCursor?: string;
  activitiesCursor?: string;
}

/**
 * CRM sync error
 */
export interface CRMSyncError {
  code: string;
  message: string;
  entityType?: 'contact' | 'account' | 'opportunity' | 'activity' | 'product';
  entityId?: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

/**
 * CRM sync warning
 */
export interface CRMSyncWarning {
  code: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

// ============================================================================
// Webhook Types
// ============================================================================

/**
 * CRM webhook event types
 */
export type CRMWebhookEvent =
  | 'contact.created'
  | 'contact.updated'
  | 'contact.deleted'
  | 'account.created'
  | 'account.updated'
  | 'account.deleted'
  | 'opportunity.created'
  | 'opportunity.updated'
  | 'opportunity.stage_changed'
  | 'opportunity.closed_won'
  | 'opportunity.closed_lost'
  | 'opportunity.deleted'
  | 'activity.created'
  | 'activity.completed';

/**
 * CRM webhook payload
 */
export interface CRMWebhookPayload {
  provider: CRMProvider;
  eventType: CRMWebhookEvent;
  timestamp: Date;
  organizationId: string;
  data: {
    entityType: 'contact' | 'account' | 'opportunity' | 'activity';
    entityId: string;
    previousValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  };
}

// ============================================================================
// Connection Types
// ============================================================================

/**
 * CRM connection
 */
export interface CRMConnection {
  id: string;
  organizationId: string;
  provider: CRMProvider;
  /** Provider instance URL (e.g., Salesforce org URL) */
  instanceUrl?: string;
  /** Provider-specific org/account ID */
  providerOrgId?: string;
  /** Status */
  status: 'active' | 'needs_attention' | 'error' | 'disconnected';
  /** Error details */
  error?: {
    code: string;
    message: string;
    requiresUserAction: boolean;
  };
  /** Last successful sync */
  lastSuccessfulSync?: Date;
  /** Last sync attempt */
  lastSyncAttempt?: Date;
  /** Encrypted credentials reference */
  credentialsRef: string;
  /** Webhook subscription ID */
  webhookSubscriptionId?: string;
  /** Configuration */
  config: CRMConnectionConfig;
  /** Sync cursors */
  syncCursors?: CRMSyncCursor;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CRM connection configuration
 */
export interface CRMConnectionConfig {
  syncContacts: boolean;
  syncAccounts: boolean;
  syncOpportunities: boolean;
  syncActivities: boolean;
  syncProducts: boolean;
  /** Auto-sync on webhook events */
  autoSyncOnWebhook: boolean;
  /** Sync interval in minutes */
  syncIntervalMinutes: number;
  /** GL mapping enabled */
  glMappingEnabled: boolean;
  /** Auto-create GL customers from accounts */
  autoCreateGLCustomers: boolean;
  /** Sync closed-won deals to revenue */
  syncClosedWonToRevenue: boolean;
}

// ============================================================================
// Salesforce-Specific Types
// ============================================================================

/**
 * Salesforce OAuth tokens
 */
export interface SalesforceOAuthTokens {
  accessToken: string;
  refreshToken: string;
  instanceUrl: string;
  tokenType: string;
  issuedAt: Date;
  expiresIn?: number;
  scope?: string;
  idToken?: string;
}

/**
 * Salesforce SOQL query result
 */
export interface SalesforceQueryResult<T> {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: T[];
}

/**
 * Salesforce record (base)
 */
export interface SalesforceRecord {
  Id: string;
  Name?: string;
  CreatedDate: string;
  LastModifiedDate: string;
  IsDeleted?: boolean;
  SystemModstamp: string;
}

/**
 * Salesforce Contact record
 */
export interface SalesforceContact extends SalesforceRecord {
  FirstName?: string;
  LastName: string;
  Email?: string;
  Phone?: string;
  MobilePhone?: string;
  Title?: string;
  Department?: string;
  AccountId?: string;
  OwnerId?: string;
  MailingStreet?: string;
  MailingCity?: string;
  MailingState?: string;
  MailingPostalCode?: string;
  MailingCountry?: string;
  LeadSource?: string;
}

/**
 * Salesforce Account record
 */
export interface SalesforceAccount extends SalesforceRecord {
  Name: string;
  Type?: string;
  Industry?: string;
  Website?: string;
  Phone?: string;
  Fax?: string;
  Description?: string;
  NumberOfEmployees?: number;
  AnnualRevenue?: number;
  OwnerId?: string;
  ParentId?: string;
  BillingStreet?: string;
  BillingCity?: string;
  BillingState?: string;
  BillingPostalCode?: string;
  BillingCountry?: string;
  ShippingStreet?: string;
  ShippingCity?: string;
  ShippingState?: string;
  ShippingPostalCode?: string;
  ShippingCountry?: string;
  SicCode?: string;
  TickerSymbol?: string;
  Rating?: string;
}

/**
 * Salesforce Opportunity record
 */
export interface SalesforceOpportunity extends SalesforceRecord {
  Name: string;
  AccountId?: string;
  Amount?: number;
  CloseDate: string;
  StageName: string;
  Probability?: number;
  Type?: string;
  LeadSource?: string;
  Description?: string;
  NextStep?: string;
  OwnerId?: string;
  IsClosed: boolean;
  IsWon: boolean;
  ForecastCategory?: string;
  ForecastCategoryName?: string;
  CampaignId?: string;
  ContactId?: string;
}

// ============================================================================
// HubSpot-Specific Types
// ============================================================================

/**
 * HubSpot OAuth tokens
 */
export interface HubSpotOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * HubSpot API response
 */
export interface HubSpotResponse<T> {
  results: T[];
  paging?: {
    next?: {
      after: string;
      link: string;
    };
  };
}

/**
 * HubSpot object (base)
 */
export interface HubSpotObject {
  id: string;
  properties: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

/**
 * HubSpot Contact properties
 */
export interface HubSpotContactProperties {
  email?: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  mobilephone?: string;
  jobtitle?: string;
  company?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  website?: string;
  lifecyclestage?: string;
  hs_lead_status?: string;
  hubspot_owner_id?: string;
  hs_object_id?: string;
}

/**
 * HubSpot Company properties
 */
export interface HubSpotCompanyProperties {
  name?: string;
  domain?: string;
  website?: string;
  phone?: string;
  industry?: string;
  type?: string;
  description?: string;
  numberofemployees?: string;
  annualrevenue?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  hubspot_owner_id?: string;
  hs_object_id?: string;
}

/**
 * HubSpot Deal properties
 */
export interface HubSpotDealProperties {
  dealname?: string;
  amount?: string;
  closedate?: string;
  dealstage?: string;
  pipeline?: string;
  hubspot_owner_id?: string;
  dealtype?: string;
  description?: string;
  hs_object_id?: string;
  hs_is_closed?: string;
  hs_is_closed_won?: string;
  hs_closed_amount?: string;
  hs_forecast_category?: string;
}

/**
 * HubSpot pipeline
 */
export interface HubSpotPipeline {
  id: string;
  label: string;
  displayOrder: number;
  stages: HubSpotPipelineStage[];
}

/**
 * HubSpot pipeline stage
 */
export interface HubSpotPipelineStage {
  id: string;
  label: string;
  displayOrder: number;
  metadata: {
    isClosed: string;
    probability: string;
  };
}
