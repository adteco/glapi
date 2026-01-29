/**
 * ServiceFactory - Centralized service instantiation with RLS context
 *
 * This factory ensures all services are properly instantiated with the
 * contextual database connection for Row-Level Security support.
 *
 * Usage in tRPC routers:
 * ```typescript
 * const services = new ServiceFactory(ctx);
 * const customer = await services.customer.getCustomerById(id);
 * const lead = await services.lead.createLead(data);
 * ```
 *
 * NOTE: Not all services are included yet. Services are being migrated
 * to support the `db` option incrementally. Services without RLS support
 * should be instantiated directly with care.
 */

import type { ContextualDatabase } from '@glapi/database';
import type { ServiceContext } from '../types';

// Services that support RLS context via options.db
import { CustomerService } from './customer-service';
import { AccountService } from './account-service';
import { ClassService } from './class-service';
import { DepartmentService } from './department-service';
import { LocationService } from './location-service';
import { SubsidiaryService } from './subsidiary-service';
import { AccountingPeriodService } from './accounting-period-service';
import { ItemsService } from './items-service';
import { ProjectService } from './project-service';
import { ProjectTaskService } from './project-task-service';
import { TimeEntryService } from './time-entry-service';
import { ExpenseEntryService } from './expense-entry-service';
import { InvoiceService } from './invoice-service';
import { PaymentService } from './payment-service';
import { SubscriptionService } from './subscription-service';
import { BillingScheduleService } from './billing-schedule-service';
import { MetricsService } from './metrics-service';

// Entity services
import { LeadService } from '../entity/lead-service';
import { ProspectService } from '../entity/prospect-service';
import { ContactService } from '../entity/contact-service';
import { VendorService } from '../entity/vendor-service';
import { EmployeeService } from '../entity/employee-service';
import { EntityService } from '../entity/entity-service';

// Services that don't need RLS context (work at org level)
import { OrganizationService } from './organization-service';
import { RevenueService } from './revenue-service';
import { SSPService } from './ssp-service';

// Factory pattern services
import { createAuditService, type AuditService } from './audit-service';
import { createEventService, type EventService } from './event-service';

/**
 * Context required for service factory
 */
export interface ServiceFactoryContext {
  /** Service context with organizationId and userId */
  serviceContext: ServiceContext;
  /** RLS-enabled contextual database connection */
  db: ContextualDatabase;
}

/**
 * ServiceFactory provides centralized, type-safe service instantiation
 * with proper RLS context for all services.
 *
 * Services are lazily instantiated on first access and cached for
 * the lifetime of the factory instance.
 */
export class ServiceFactory {
  private readonly context: ServiceContext;
  private readonly db: ContextualDatabase;

  // Cached service instances - RLS-enabled services
  private _customer?: CustomerService;
  private _account?: AccountService;
  private _class?: ClassService;
  private _department?: DepartmentService;
  private _location?: LocationService;
  private _subsidiary?: SubsidiaryService;
  private _accountingPeriod?: AccountingPeriodService;
  private _items?: ItemsService;
  private _project?: ProjectService;
  private _projectTask?: ProjectTaskService;
  private _timeEntry?: TimeEntryService;
  private _expenseEntry?: ExpenseEntryService;
  private _invoice?: InvoiceService;
  private _payment?: PaymentService;
  private _subscription?: SubscriptionService;
  private _billingSchedule?: BillingScheduleService;
  private _metrics?: MetricsService;

  // Entity services
  private _lead?: LeadService;
  private _prospect?: ProspectService;
  private _contact?: ContactService;
  private _vendor?: VendorService;
  private _employee?: EmployeeService;
  private _entity?: EntityService;

  // Non-RLS services
  private _organization?: OrganizationService;
  private _revenue?: RevenueService;
  private _ssp?: SSPService;

  // Factory-pattern services
  private _audit?: AuditService;
  private _event?: EventService;

  constructor(ctx: ServiceFactoryContext) {
    this.context = ctx.serviceContext;
    this.db = ctx.db;
  }

  /**
   * Create a ServiceFactory from tRPC context
   */
  static fromContext(ctx: { serviceContext: ServiceContext; db: ContextualDatabase }): ServiceFactory {
    return new ServiceFactory(ctx);
  }

  // ============================================================================
  // Core Dimension Services (RLS-enabled)
  // ============================================================================

  get customer(): CustomerService {
    if (!this._customer) {
      this._customer = new CustomerService(this.context, { db: this.db });
    }
    return this._customer;
  }

  get account(): AccountService {
    if (!this._account) {
      this._account = new AccountService(this.context, { db: this.db });
    }
    return this._account;
  }

  get class(): ClassService {
    if (!this._class) {
      this._class = new ClassService(this.context, { db: this.db });
    }
    return this._class;
  }

  get department(): DepartmentService {
    if (!this._department) {
      this._department = new DepartmentService(this.context, { db: this.db });
    }
    return this._department;
  }

  get location(): LocationService {
    if (!this._location) {
      this._location = new LocationService(this.context, { db: this.db });
    }
    return this._location;
  }

  get subsidiary(): SubsidiaryService {
    if (!this._subsidiary) {
      this._subsidiary = new SubsidiaryService(this.context, { db: this.db });
    }
    return this._subsidiary;
  }

  // ============================================================================
  // Accounting Services (RLS-enabled)
  // ============================================================================

  get accountingPeriod(): AccountingPeriodService {
    if (!this._accountingPeriod) {
      this._accountingPeriod = new AccountingPeriodService(this.context, { db: this.db });
    }
    return this._accountingPeriod;
  }

  // ============================================================================
  // Items & Inventory Services (RLS-enabled)
  // ============================================================================

  get items(): ItemsService {
    if (!this._items) {
      this._items = new ItemsService(this.context, { db: this.db });
    }
    return this._items;
  }

  // ============================================================================
  // Project Services (RLS-enabled)
  // ============================================================================

  get project(): ProjectService {
    if (!this._project) {
      this._project = new ProjectService(this.context, { db: this.db });
    }
    return this._project;
  }

  get projectTask(): ProjectTaskService {
    if (!this._projectTask) {
      this._projectTask = new ProjectTaskService(this.context, { db: this.db });
    }
    return this._projectTask;
  }

  // ============================================================================
  // Time & Expense Services (RLS-enabled)
  // ============================================================================

  get timeEntry(): TimeEntryService {
    if (!this._timeEntry) {
      this._timeEntry = new TimeEntryService(this.context, { db: this.db });
    }
    return this._timeEntry;
  }

  get expenseEntry(): ExpenseEntryService {
    if (!this._expenseEntry) {
      this._expenseEntry = new ExpenseEntryService(this.context, { db: this.db });
    }
    return this._expenseEntry;
  }

  // ============================================================================
  // Billing & Payment Services (RLS-enabled)
  // ============================================================================

  get invoice(): InvoiceService {
    if (!this._invoice) {
      this._invoice = new InvoiceService(this.context, { db: this.db });
    }
    return this._invoice;
  }

  get payment(): PaymentService {
    if (!this._payment) {
      this._payment = new PaymentService(this.context, { db: this.db });
    }
    return this._payment;
  }

  get subscription(): SubscriptionService {
    if (!this._subscription) {
      this._subscription = new SubscriptionService(this.context, { db: this.db });
    }
    return this._subscription;
  }

  get billingSchedule(): BillingScheduleService {
    if (!this._billingSchedule) {
      this._billingSchedule = new BillingScheduleService(this.context, { db: this.db });
    }
    return this._billingSchedule;
  }

  // ============================================================================
  // Metrics & Reporting (RLS-enabled)
  // ============================================================================

  get metrics(): MetricsService {
    if (!this._metrics) {
      this._metrics = new MetricsService(this.context, { db: this.db });
    }
    return this._metrics;
  }

  // ============================================================================
  // Entity Services (RLS-enabled) - Lead, Prospect, Contact, etc.
  // ============================================================================

  get lead(): LeadService {
    if (!this._lead) {
      this._lead = new LeadService(this.context, { db: this.db });
    }
    return this._lead;
  }

  get prospect(): ProspectService {
    if (!this._prospect) {
      this._prospect = new ProspectService(this.context, { db: this.db });
    }
    return this._prospect;
  }

  get contact(): ContactService {
    if (!this._contact) {
      this._contact = new ContactService(this.context, { db: this.db });
    }
    return this._contact;
  }

  get vendor(): VendorService {
    if (!this._vendor) {
      this._vendor = new VendorService(this.context, { db: this.db });
    }
    return this._vendor;
  }

  get employee(): EmployeeService {
    if (!this._employee) {
      this._employee = new EmployeeService(this.context, { db: this.db });
    }
    return this._employee;
  }

  get entity(): EntityService {
    if (!this._entity) {
      this._entity = new EntityService(this.context, { db: this.db });
    }
    return this._entity;
  }

  // ============================================================================
  // Revenue Recognition Services (RLS-enabled)
  // ============================================================================

  get revenue(): RevenueService {
    if (!this._revenue) {
      this._revenue = new RevenueService(this.context, { db: this.db });
    }
    return this._revenue;
  }

  get ssp(): SSPService {
    if (!this._ssp) {
      this._ssp = new SSPService(this.context, { db: this.db });
    }
    return this._ssp;
  }

  // ============================================================================
  // Non-RLS Services (organization-level or cross-org operations)
  // These services manage organization setup or don't contain org-specific data
  // ============================================================================

  get organization(): OrganizationService {
    if (!this._organization) {
      this._organization = new OrganizationService(this.context);
    }
    return this._organization;
  }

  // ============================================================================
  // Factory-Pattern Services
  // ============================================================================

  get audit(): AuditService {
    if (!this._audit) {
      this._audit = createAuditService(this.context);
    }
    return this._audit;
  }

  get event(): EventService {
    if (!this._event) {
      this._event = createEventService(this.context);
    }
    return this._event;
  }
}

/**
 * Create a ServiceFactory from tRPC context
 *
 * @example
 * ```typescript
 * // In a tRPC procedure
 * const services = createServiceFactory(ctx);
 * const customer = await services.customer.getCustomerById(id);
 * ```
 */
export function createServiceFactory(ctx: ServiceFactoryContext): ServiceFactory {
  return new ServiceFactory(ctx);
}
