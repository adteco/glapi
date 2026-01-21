/**
 * GLAPI SDK - TypeScript SDK for General Ledger and Accounting API
 *
 * @packageDocumentation
 */

// Re-export generated types and services
export * from './generated';

// Import for client configuration
import { OpenAPI, type OpenAPIConfig } from './generated';
import {
  CustomersService,
  VendorsService,
  AccountsService,
  ItemsService,
  InvoicesService,
  PaymentsService,
  SubscriptionsService,
  OrganizationsService,
  SubsidiariesService,
  DepartmentsService,
  LocationsService,
  ClassesService,
  EmployeesService,
  WarehousesService,
  ContactsService,
  LeadsService,
  ProspectsService,
  PriceListsService,
  UnitsOfMeasureService,
  RevenueService,
  BusinessTransactionsService,
} from './generated';

/**
 * Configuration options for the GLAPI client
 */
export interface GlapiClientConfig {
  /**
   * Base URL for the API
   * @default 'http://localhost:3031/api'
   */
  baseUrl?: string;

  /**
   * Authentication token (Bearer token from Clerk)
   * Can be a string or an async function that returns a token
   */
  token?: string | (() => Promise<string>);

  /**
   * Custom headers to include with every request
   */
  headers?: Record<string, string>;

  /**
   * Whether to include credentials in cross-origin requests
   * @default false
   */
  withCredentials?: boolean;
}

/**
 * Configure the GLAPI SDK globally
 *
 * @example
 * ```typescript
 * import { configure } from '@glapi/sdk';
 *
 * // With static token
 * configure({
 *   baseUrl: 'https://api.glapi.io/api',
 *   token: 'your-clerk-token',
 * });
 *
 * // With dynamic token (e.g., from Clerk)
 * configure({
 *   baseUrl: 'https://api.glapi.io/api',
 *   token: async () => {
 *     const { getToken } = useAuth();
 *     return await getToken() ?? '';
 *   },
 * });
 * ```
 */
export function configure(config: GlapiClientConfig): void {
  if (config.baseUrl) {
    OpenAPI.BASE = config.baseUrl;
  }

  if (config.token) {
    if (typeof config.token === 'string') {
      OpenAPI.TOKEN = config.token;
    } else {
      OpenAPI.TOKEN = config.token;
    }
  }

  if (config.headers) {
    OpenAPI.HEADERS = config.headers;
  }

  if (config.withCredentials !== undefined) {
    OpenAPI.WITH_CREDENTIALS = config.withCredentials;
    OpenAPI.CREDENTIALS = config.withCredentials ? 'include' : 'omit';
  }
}

/**
 * Get the current SDK configuration
 */
export function getConfig(): OpenAPIConfig {
  return { ...OpenAPI };
}

/**
 * Reset the SDK configuration to defaults
 */
export function resetConfig(): void {
  OpenAPI.BASE = 'http://localhost:3031/api';
  OpenAPI.TOKEN = undefined;
  OpenAPI.HEADERS = undefined;
  OpenAPI.WITH_CREDENTIALS = false;
  OpenAPI.CREDENTIALS = 'include';
}

/**
 * GLAPI Client class providing a unified interface to all API services
 *
 * @example
 * ```typescript
 * import { GlapiClient } from '@glapi/sdk';
 *
 * const client = new GlapiClient({
 *   baseUrl: 'https://api.glapi.io/api',
 *   token: 'your-clerk-token',
 * });
 *
 * // List customers
 * const customers = await client.customers.list();
 *
 * // Create a vendor
 * const vendor = await client.vendors.create({
 *   name: 'Acme Corp',
 *   email: 'contact@acme.com',
 * });
 * ```
 */
export class GlapiClient {
  /**
   * Create a new GLAPI client instance
   * @param config - Client configuration
   */
  constructor(config?: GlapiClientConfig) {
    if (config) {
      configure(config);
    }
  }

  // ==========================================================================
  // Core Accounting Dimensions
  // ==========================================================================

  /** Customer management */
  readonly customers = {
    list: () => CustomersService.customersList(),
    get: (id: string) => CustomersService.customersGet({ id }),
    create: (data: Record<string, unknown>) =>
      CustomersService.customersCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      CustomersService.customersUpdate({ id, requestBody: data }),
    delete: (id: string) => CustomersService.customersDelete({ id }),
  };

  /** Vendor management */
  readonly vendors = {
    list: () => VendorsService.vendorsList(),
    get: (id: string) => VendorsService.vendorsGet({ id }),
    create: (data: Record<string, unknown>) =>
      VendorsService.vendorsCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      VendorsService.vendorsUpdate({ id, requestBody: data }),
    delete: (id: string) => VendorsService.vendorsDelete({ id }),
  };

  /** Chart of accounts */
  readonly accounts = {
    list: () => AccountsService.accountsList(),
    get: (id: string) => AccountsService.accountsGet({ id }),
    create: (data: Record<string, unknown>) =>
      AccountsService.accountsCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      AccountsService.accountsUpdate({ id, requestBody: data }),
    delete: (id: string) => AccountsService.accountsDelete({ id }),
  };

  // ==========================================================================
  // Organizational Structure
  // ==========================================================================

  /** Organization management */
  readonly organizations = {
    list: () => OrganizationsService.organizationsList(),
    get: (id: string) => OrganizationsService.organizationsGet({ id }),
    create: (data: Record<string, unknown>) =>
      OrganizationsService.organizationsCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      OrganizationsService.organizationsUpdate({ id, requestBody: data }),
    delete: (id: string) => OrganizationsService.organizationsDelete({ id }),
  };

  /** Subsidiary management */
  readonly subsidiaries = {
    list: () => SubsidiariesService.subsidiariesList(),
    get: (id: string) => SubsidiariesService.subsidiariesGet({ id }),
    create: (data: Record<string, unknown>) =>
      SubsidiariesService.subsidiariesCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      SubsidiariesService.subsidiariesUpdate({ id, requestBody: data }),
    delete: (id: string) => SubsidiariesService.subsidiariesDelete({ id }),
  };

  /** Department management */
  readonly departments = {
    list: () => DepartmentsService.departmentsList(),
    get: (id: string) => DepartmentsService.departmentsGet({ id }),
    create: (data: Record<string, unknown>) =>
      DepartmentsService.departmentsCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      DepartmentsService.departmentsUpdate({ id, requestBody: data }),
    delete: (id: string) => DepartmentsService.departmentsDelete({ id }),
  };

  /** Location management */
  readonly locations = {
    list: () => LocationsService.locationsList(),
    get: (id: string) => LocationsService.locationsGet({ id }),
    create: (data: Record<string, unknown>) =>
      LocationsService.locationsCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      LocationsService.locationsUpdate({ id, requestBody: data }),
    delete: (id: string) => LocationsService.locationsDelete({ id }),
  };

  /** Class management (classification segments) */
  readonly classes = {
    list: () => ClassesService.classesList(),
    get: (id: string) => ClassesService.classesGet({ id }),
    create: (data: Record<string, unknown>) =>
      ClassesService.classesCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      ClassesService.classesUpdate({ id, requestBody: data }),
    delete: (id: string) => ClassesService.classesDelete({ id }),
  };

  // ==========================================================================
  // Inventory & Items
  // ==========================================================================

  /** Item/product management */
  readonly items = {
    list: () => ItemsService.itemsList(),
    get: (id: string) => ItemsService.itemsGet({ id }),
    create: (data: Record<string, unknown>) =>
      ItemsService.itemsCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      ItemsService.itemsUpdate({ id, requestBody: data }),
    delete: (id: string) => ItemsService.itemsDelete({ id }),
  };

  /** Warehouse management */
  readonly warehouses = {
    list: () => WarehousesService.warehousesList(),
    get: (id: string) => WarehousesService.warehousesGet({ id }),
    create: (data: Record<string, unknown>) =>
      WarehousesService.warehousesCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      WarehousesService.warehousesUpdate({ id, requestBody: data }),
    delete: (id: string) => WarehousesService.warehousesDelete({ id }),
  };

  /** Price list management */
  readonly priceLists = {
    list: () => PriceListsService.priceListsList(),
    get: (id: string) => PriceListsService.priceListsGet({ id }),
    create: (data: Record<string, unknown>) =>
      PriceListsService.priceListsCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      PriceListsService.priceListsUpdate({ id, requestBody: data }),
    delete: (id: string) => PriceListsService.priceListsDelete({ id }),
  };

  /** Units of measure */
  readonly unitsOfMeasure = {
    list: () => UnitsOfMeasureService.unitsOfMeasureList(),
    get: (id: string) => UnitsOfMeasureService.unitsOfMeasureGet({ id }),
    create: (data: Record<string, unknown>) =>
      UnitsOfMeasureService.unitsOfMeasureCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      UnitsOfMeasureService.unitsOfMeasureUpdate({ id, requestBody: data }),
    delete: (id: string) => UnitsOfMeasureService.unitsOfMeasureDelete({ id }),
  };

  // ==========================================================================
  // Financial Operations
  // ==========================================================================

  /** Invoice management */
  readonly invoices = {
    list: () => InvoicesService.invoicesList(),
    get: (id: string) => InvoicesService.invoicesGet({ id }),
    create: (data: Record<string, unknown>) =>
      InvoicesService.invoicesCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      InvoicesService.invoicesUpdate({ id, requestBody: data }),
    delete: (id: string) => InvoicesService.invoicesDelete({ id }),
  };

  /** Payment management */
  readonly payments = {
    list: () => PaymentsService.paymentsList(),
    get: (id: string) => PaymentsService.paymentsGet({ id }),
    create: (data: Record<string, unknown>) =>
      PaymentsService.paymentsCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      PaymentsService.paymentsUpdate({ id, requestBody: data }),
    delete: (id: string) => PaymentsService.paymentsDelete({ id }),
  };

  /** Subscription management */
  readonly subscriptions = {
    list: () => SubscriptionsService.subscriptionsList(),
    get: (id: string) => SubscriptionsService.subscriptionsGet({ id }),
    create: (data: Record<string, unknown>) =>
      SubscriptionsService.subscriptionsCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      SubscriptionsService.subscriptionsUpdate({ id, requestBody: data }),
    delete: (id: string) => SubscriptionsService.subscriptionsDelete({ id }),
  };

  /** Revenue recognition */
  readonly revenue = {
    list: () => RevenueService.revenueList(),
    get: (id: string) => RevenueService.revenueGet({ id }),
    create: (data: Record<string, unknown>) =>
      RevenueService.revenueCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      RevenueService.revenueUpdate({ id, requestBody: data }),
    delete: (id: string) => RevenueService.revenueDelete({ id }),
  };

  /** Business transactions */
  readonly transactions = {
    list: () => BusinessTransactionsService.businessTransactionsList(),
    get: (id: string) => BusinessTransactionsService.businessTransactionsGet({ id }),
    create: (data: Record<string, unknown>) =>
      BusinessTransactionsService.businessTransactionsCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      BusinessTransactionsService.businessTransactionsUpdate({ id, requestBody: data }),
    delete: (id: string) => BusinessTransactionsService.businessTransactionsDelete({ id }),
  };

  // ==========================================================================
  // People & Contacts
  // ==========================================================================

  /** Employee management */
  readonly employees = {
    list: () => EmployeesService.employeesList(),
    get: (id: string) => EmployeesService.employeesGet({ id }),
    create: (data: Record<string, unknown>) =>
      EmployeesService.employeesCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      EmployeesService.employeesUpdate({ id, requestBody: data }),
    delete: (id: string) => EmployeesService.employeesDelete({ id }),
  };

  /** Contact management */
  readonly contacts = {
    list: () => ContactsService.contactsList(),
    get: (id: string) => ContactsService.contactsGet({ id }),
    create: (data: Record<string, unknown>) =>
      ContactsService.contactsCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      ContactsService.contactsUpdate({ id, requestBody: data }),
    delete: (id: string) => ContactsService.contactsDelete({ id }),
  };

  /** Lead management */
  readonly leads = {
    list: () => LeadsService.leadsList(),
    get: (id: string) => LeadsService.leadsGet({ id }),
    create: (data: Record<string, unknown>) =>
      LeadsService.leadsCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      LeadsService.leadsUpdate({ id, requestBody: data }),
    delete: (id: string) => LeadsService.leadsDelete({ id }),
  };

  /** Prospect management */
  readonly prospects = {
    list: () => ProspectsService.prospectsList(),
    get: (id: string) => ProspectsService.prospectsGet({ id }),
    create: (data: Record<string, unknown>) =>
      ProspectsService.prospectsCreate({ requestBody: data }),
    update: (id: string, data: Record<string, unknown>) =>
      ProspectsService.prospectsUpdate({ id, requestBody: data }),
    delete: (id: string) => ProspectsService.prospectsDelete({ id }),
  };
}

/**
 * Default export - pre-configured client instance
 * Configure using the `configure()` function before use
 */
export const glapi = new GlapiClient();
