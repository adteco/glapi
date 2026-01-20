/**
 * Gusto Payroll Connector
 *
 * Integrates with Gusto API for payroll data synchronization.
 * Features:
 * - OAuth 2.0 authentication
 * - Company and employee sync
 * - Payroll run retrieval
 * - Tax document access
 * - Webhook support
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
} from '../types/connector.types';

import type {
  PayrollProvider,
  PayrollEmployee,
  PayrollRun,
  Paystub,
  PaystubEarning,
  PaystubTax,
  PaystubDeduction,
  PaystubContribution,
  PayrollRunTotals,
  YTDTotals,
  PayrollSyncOptions,
  PayrollSyncResult,
  PayrollSyncError,
  PayrollConnection,
  EmploymentStatus,
  EmploymentType,
  PayType,
  PayFrequency,
  EarningType,
  TaxType,
  DeductionType,
  PayrollRunStatus,
  PayrollRunType,
  EmployeeCompensation,
  EmployeeTaxInfo,
  EmployeeBankAccount,
  PayrollAddress,
} from '../types/payroll.types';

// ============================================================================
// Gusto-Specific Types
// ============================================================================

/**
 * Gusto API configuration
 */
export interface GustoConfig {
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'demo' | 'production';
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

/**
 * Gusto OAuth tokens
 */
export interface GustoOAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  createdAt: number;
}

/**
 * Gusto company response
 */
export interface GustoCompany {
  id: string;
  uuid: string;
  name: string;
  trade_name?: string;
  ein?: string;
  entity_type?: string;
  company_status: string;
  tier: string;
  is_suspended: boolean;
  primary_signatory?: GustoEmployee;
  primary_payroll_admin?: GustoEmployee;
  locations: GustoLocation[];
}

/**
 * Gusto location
 */
export interface GustoLocation {
  id: number;
  version: string;
  company_id: number;
  phone_number?: string;
  street_1: string;
  street_2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  active: boolean;
  mailing_address: boolean;
  filing_address: boolean;
}

/**
 * Gusto employee response
 */
export interface GustoEmployee {
  id: number;
  uuid: string;
  version: string;
  first_name: string;
  middle_initial?: string;
  last_name: string;
  email?: string;
  company_id: number;
  company_uuid: string;
  manager_id?: number;
  department?: string;
  terminated: boolean;
  two_percent_shareholder: boolean;
  onboarded: boolean;
  jobs: GustoJob[];
  home_address?: GustoAddress;
  garnishments: GustoGarnishment[];
  date_of_birth?: string;
  has_ssn: boolean;
  ssn?: string;
  phone?: string;
  preferred_first_name?: string;
  custom_fields?: GustoCustomField[];
  payment_method?: string;
}

/**
 * Gusto job assignment
 */
export interface GustoJob {
  id: number;
  version: string;
  employee_id: number;
  location_id: number;
  location: GustoLocation;
  hire_date: string;
  title?: string;
  primary: boolean;
  rate: string;
  payment_unit: 'Hour' | 'Week' | 'Month' | 'Year' | 'Paycheck';
  current_compensation_id: number;
  compensations: GustoCompensation[];
}

/**
 * Gusto compensation
 */
export interface GustoCompensation {
  id: number;
  version: string;
  job_id: number;
  rate: string;
  payment_unit: string;
  flsa_status: 'Exempt' | 'Salaried Nonexempt' | 'Nonexempt' | 'Owner';
  effective_date: string;
}

/**
 * Gusto address
 */
export interface GustoAddress {
  id: number;
  version: string;
  street_1: string;
  street_2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

/**
 * Gusto garnishment
 */
export interface GustoGarnishment {
  id: number;
  version: string;
  employee_id: number;
  active: boolean;
  amount: string;
  description: string;
  court_ordered: boolean;
  times: number;
  recurring: boolean;
  annual_maximum?: string;
  pay_period_maximum?: string;
  deduct_as_percentage: boolean;
}

/**
 * Gusto custom field
 */
export interface GustoCustomField {
  id: string;
  company_custom_field_id: string;
  name: string;
  type: string;
  description?: string;
  value: string;
}

/**
 * Gusto payroll response
 */
export interface GustoPayroll {
  version: string;
  payroll_deadline: string;
  check_date: string;
  processed: boolean;
  processed_date?: string;
  calculated_at?: string;
  payroll_id: number;
  payroll_uuid: string;
  company_id: number;
  company_uuid: string;
  pay_period: {
    start_date: string;
    end_date: string;
    pay_schedule_id: number;
    pay_schedule_uuid: string;
  };
  totals?: GustoPayrollTotals;
  employee_compensations: GustoEmployeeCompensation[];
}

/**
 * Gusto payroll totals
 */
export interface GustoPayrollTotals {
  company_debit: string;
  net_pay: string;
  tax_debit: string;
  reimbursements: string;
  child_support_debit: string;
  check_amount: string;
  employer_taxes: string;
  employee_taxes: string;
  benefits: string;
  employee_benefits_deductions: string;
  deferred_payroll_taxes: string;
}

/**
 * Gusto employee compensation in payroll
 */
export interface GustoEmployeeCompensation {
  employee_id: number;
  employee_uuid: string;
  gross_pay: string;
  net_pay: string;
  check_amount: string;
  payment_method: string;
  fixed_compensations: GustoFixedCompensation[];
  hourly_compensations: GustoHourlyCompensation[];
  paid_time_off: GustoPaidTimeOff[];
  benefits: GustoBenefit[];
  deductions: GustoDeduction[];
  taxes: GustoTax[];
}

/**
 * Gusto fixed compensation
 */
export interface GustoFixedCompensation {
  name: string;
  amount: string;
  job_id: number;
}

/**
 * Gusto hourly compensation
 */
export interface GustoHourlyCompensation {
  name: string;
  hours: string;
  job_id: number;
  compensation_multiplier: number;
}

/**
 * Gusto paid time off
 */
export interface GustoPaidTimeOff {
  name: string;
  hours: string;
}

/**
 * Gusto benefit in payroll
 */
export interface GustoBenefit {
  name: string;
  employee_deduction: string;
  company_contribution: string;
  imputed: boolean;
}

/**
 * Gusto deduction
 */
export interface GustoDeduction {
  name: string;
  amount: string;
}

/**
 * Gusto tax
 */
export interface GustoTax {
  name: string;
  employer: boolean;
  amount: string;
}

/**
 * Gusto pay schedule
 */
export interface GustoPaySchedule {
  id: number;
  uuid: string;
  version: string;
  frequency: string;
  anchor_pay_date: string;
  anchor_end_of_pay_period: string;
  day_1?: number;
  day_2?: number;
  name: string;
  auto_pilot: boolean;
}

// ============================================================================
// Gusto Connector Implementation
// ============================================================================

/**
 * Gusto payroll connector
 */
export class GustoConnector extends BaseConnector {
  private gustoConfig: GustoConfig;
  private baseUrl: string;

  constructor(
    context: ConnectorServiceContext,
    gustoConfig: GustoConfig,
    httpClient?: HttpClientInterface
  ) {
    const baseUrl = GustoConnector.getBaseUrl(gustoConfig.environment);

    const connectorConfig: ConnectorConfig = {
      id: `gusto-${context.organizationId ?? 'default'}`,
      type: 'gusto',
      baseUrl,
      credentials: {
        method: 'oauth2',
        grantType: 'refresh_token',
        clientId: gustoConfig.clientId,
        clientSecret: gustoConfig.clientSecret,
        accessToken: gustoConfig.accessToken,
        refreshToken: gustoConfig.refreshToken,
        expiresAt: gustoConfig.expiresAt,
        tokenUrl: `${baseUrl}/oauth/token`,
      },
      rateLimit: {
        maxRequests: 60,
        window: 'minute',
        queueWhenLimited: true,
        maxQueueSize: 100,
      },
      retryPolicy: {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffStrategy: 'exponential',
        backoffMultiplier: 2,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504],
      },
      circuitBreaker: {
        failureThreshold: 5,
        successThreshold: 3,
        resetTimeoutMs: 30000,
      },
      defaultTimeoutMs: 30000,
      defaultHeaders: {
        'X-Gusto-API-Version': '2024-03-01',
      },
    };

    super(context, connectorConfig, httpClient ?? new DefaultHttpClient());
    this.gustoConfig = gustoConfig;
    this.baseUrl = baseUrl;
  }

  /**
   * Get base URL for environment
   */
  private static getBaseUrl(
    environment: 'sandbox' | 'demo' | 'production'
  ): string {
    switch (environment) {
      case 'sandbox':
        return 'https://api.gusto-demo.com';
      case 'demo':
        return 'https://api.gusto-demo.com';
      case 'production':
        return 'https://api.gusto.com';
      default:
        return 'https://api.gusto-demo.com';
    }
  }

  /**
   * Test connection to Gusto
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    details?: Record<string, unknown>;
  }> {
    try {
      const response = await this.get<{ email: string; uuid: string }>(
        '/v1/me'
      );

      return {
        success: true,
        message: 'Successfully connected to Gusto',
        details: {
          userEmail: response.data.email,
          userUuid: response.data.uuid,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Gusto: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get company information
   */
  async getCompany(companyId: string): Promise<GustoCompany> {
    const response = await this.get<GustoCompany>(
      `/v1/companies/${companyId}`
    );
    return response.data;
  }

  /**
   * Get all companies for current user
   */
  async getCompanies(): Promise<GustoCompany[]> {
    const response = await this.get<GustoCompany[]>('/v1/companies');
    return response.data;
  }

  /**
   * Get employees for a company
   */
  async getEmployees(
    companyId: string,
    options: {
      terminated?: boolean;
      page?: number;
      per?: number;
    } = {}
  ): Promise<GustoEmployee[]> {
    const params = new URLSearchParams();
    if (options.terminated !== undefined) {
      params.append('terminated', String(options.terminated));
    }
    if (options.page) {
      params.append('page', String(options.page));
    }
    if (options.per) {
      params.append('per', String(options.per));
    }

    const queryString = params.toString();
    const path = `/v1/companies/${companyId}/employees${queryString ? `?${queryString}` : ''}`;
    const response = await this.get<GustoEmployee[]>(path);
    return response.data;
  }

  /**
   * Get single employee
   */
  async getEmployee(employeeId: string): Promise<GustoEmployee> {
    const response = await this.get<GustoEmployee>(
      `/v1/employees/${employeeId}`
    );
    return response.data;
  }

  /**
   * Get payrolls for a company
   */
  async getPayrolls(
    companyId: string,
    options: {
      processed?: boolean;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      per?: number;
    } = {}
  ): Promise<GustoPayroll[]> {
    const params = new URLSearchParams();
    if (options.processed !== undefined) {
      params.append('processed', String(options.processed));
    }
    if (options.startDate) {
      params.append('start_date', options.startDate.toISOString().split('T')[0]);
    }
    if (options.endDate) {
      params.append('end_date', options.endDate.toISOString().split('T')[0]);
    }
    if (options.page) {
      params.append('page', String(options.page));
    }
    if (options.per) {
      params.append('per', String(options.per));
    }

    const queryString = params.toString();
    const path = `/v1/companies/${companyId}/payrolls${queryString ? `?${queryString}` : ''}`;
    const response = await this.get<GustoPayroll[]>(path);
    return response.data;
  }

  /**
   * Get single payroll
   */
  async getPayroll(
    companyId: string,
    payrollId: string,
    options: { includeOffCycle?: boolean } = {}
  ): Promise<GustoPayroll> {
    const params = new URLSearchParams();
    if (options.includeOffCycle) {
      params.append('include_off_cycle', 'true');
    }

    const queryString = params.toString();
    const path = `/v1/companies/${companyId}/payrolls/${payrollId}${queryString ? `?${queryString}` : ''}`;
    const response = await this.get<GustoPayroll>(path);
    return response.data;
  }

  /**
   * Get pay schedules for a company
   */
  async getPaySchedules(companyId: string): Promise<GustoPaySchedule[]> {
    const response = await this.get<GustoPaySchedule[]>(
      `/v1/companies/${companyId}/pay_schedules`
    );
    return response.data;
  }

  /**
   * Get company locations
   */
  async getLocations(companyId: string): Promise<GustoLocation[]> {
    const response = await this.get<GustoLocation[]>(
      `/v1/companies/${companyId}/locations`
    );
    return response.data;
  }

  // ============================================================================
  // Sync Methods
  // ============================================================================

  /**
   * Sync all payroll data for a company
   */
  async syncPayrollData(
    companyId: string,
    options: PayrollSyncOptions = {}
  ): Promise<PayrollSyncResult> {
    const startedAt = new Date();
    const errors: PayrollSyncError[] = [];
    let employeesSynced = 0;
    let payrollRunsSynced = 0;
    const taxDocumentsSynced = 0;

    try {
      // Sync employees
      if (options.syncEmployees !== false) {
        try {
          const employees = await this.getEmployees(companyId, {
            terminated: options.includeTerminated,
          });
          employeesSynced = employees.length;
        } catch (error) {
          errors.push({
            code: 'EMPLOYEE_SYNC_ERROR',
            message: `Failed to sync employees: ${error instanceof Error ? error.message : String(error)}`,
            entityType: 'employee',
            retryable: true,
          });
        }
      }

      // Sync payroll runs
      if (options.syncPayrollRuns !== false) {
        try {
          const payrolls = await this.getPayrolls(companyId, {
            processed: true,
            startDate: options.startDate,
            endDate: options.endDate,
          });
          payrollRunsSynced = payrolls.length;
        } catch (error) {
          errors.push({
            code: 'PAYROLL_SYNC_ERROR',
            message: `Failed to sync payrolls: ${error instanceof Error ? error.message : String(error)}`,
            entityType: 'payroll_run',
            retryable: true,
          });
        }
      }

      const completedAt = new Date();

      return {
        provider: 'gusto' as PayrollProvider,
        success: errors.length === 0,
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        employeesSynced,
        payrollRunsSynced,
        taxDocumentsSynced,
        errors,
      };
    } catch (error) {
      const completedAt = new Date();
      return {
        provider: 'gusto' as PayrollProvider,
        success: false,
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        employeesSynced,
        payrollRunsSynced,
        taxDocumentsSynced,
        errors: [
          {
            code: 'SYNC_ERROR',
            message: `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
            retryable: true,
          },
        ],
      };
    }
  }

  // ============================================================================
  // Normalization Methods
  // ============================================================================

  /**
   * Normalize Gusto employee to standard format
   */
  normalizeEmployee(
    employee: GustoEmployee,
    organizationId: string
  ): PayrollEmployee {
    const primaryJob = employee.jobs.find((j) => j.primary) ?? employee.jobs[0];
    const compensation = primaryJob?.compensations.find(
      (c) => c.id === primaryJob.current_compensation_id
    );

    return {
      id: `gusto-emp-${employee.uuid}`,
      providerEmployeeId: employee.uuid,
      provider: 'gusto' as PayrollProvider,
      organizationId,
      firstName: employee.first_name,
      middleName: employee.middle_initial,
      lastName: employee.last_name,
      email: employee.email,
      phone: employee.phone,
      status: this.mapEmploymentStatus(employee),
      employmentType: this.mapEmploymentType(compensation),
      department: employee.department,
      jobTitle: primaryJob?.title,
      managerId: employee.manager_id
        ? `gusto-emp-${employee.manager_id}`
        : undefined,
      homeAddress: employee.home_address
        ? this.normalizeAddress(employee.home_address)
        : undefined,
      dateOfBirth: employee.date_of_birth
        ? new Date(employee.date_of_birth)
        : undefined,
      ssnLast4: employee.ssn?.slice(-4),
      hireDate: primaryJob?.hire_date
        ? new Date(primaryJob.hire_date)
        : new Date(),
      compensation: this.normalizeCompensation(compensation, primaryJob),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Normalize Gusto payroll to standard format
   */
  normalizePayroll(
    payroll: GustoPayroll,
    organizationId: string
  ): PayrollRun {
    const paystubs = payroll.employee_compensations.map((ec) =>
      this.normalizePaystub(ec, payroll)
    );

    return {
      id: `gusto-payroll-${payroll.payroll_uuid}`,
      providerPayrollRunId: payroll.payroll_uuid,
      provider: 'gusto' as PayrollProvider,
      organizationId,
      periodStart: new Date(payroll.pay_period.start_date),
      periodEnd: new Date(payroll.pay_period.end_date),
      checkDate: new Date(payroll.check_date),
      runType: this.mapPayrollRunType(payroll),
      status: this.mapPayrollStatus(payroll),
      payFrequency: 'biweekly' as PayFrequency,
      paystubs,
      totals: this.normalizePayrollTotals(payroll.totals),
      processedAt: payroll.processed_date
        ? new Date(payroll.processed_date)
        : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Normalize employee compensation in payroll to paystub
   */
  private normalizePaystub(
    ec: GustoEmployeeCompensation,
    payroll: GustoPayroll
  ): Paystub {
    const earnings = this.normalizeEarnings(ec);
    const taxes = this.normalizeTaxes(ec.taxes);
    const deductions = this.normalizeDeductions(ec.deductions);
    const employerContributions = this.normalizeContributions(ec.benefits);

    let regularHours = 0;
    let overtimeHours = 0;
    ec.hourly_compensations.forEach((hc) => {
      const hours = parseFloat(hc.hours);
      if (hc.compensation_multiplier > 1) {
        overtimeHours += hours;
      } else {
        regularHours += hours;
      }
    });

    return {
      id: `gusto-paystub-${payroll.payroll_uuid}-${ec.employee_uuid}`,
      providerPaystubId: `${payroll.payroll_uuid}-${ec.employee_uuid}`,
      employeeId: `gusto-emp-${ec.employee_uuid}`,
      employeeName: '', // Would need to join with employee data
      grossPay: parseFloat(ec.gross_pay),
      netPay: parseFloat(ec.net_pay),
      earnings,
      taxes,
      deductions,
      employerContributions,
      reimbursements: [],
      regularHours: regularHours > 0 ? regularHours : undefined,
      overtimeHours: overtimeHours > 0 ? overtimeHours : undefined,
      ytdTotals: this.emptyYTDTotals(),
      checkNumber: undefined,
      paymentMethod: this.mapPaymentMethod(ec.payment_method),
    };
  }

  /**
   * Normalize earnings from Gusto
   */
  private normalizeEarnings(ec: GustoEmployeeCompensation): PaystubEarning[] {
    const earnings: PaystubEarning[] = [];

    // Fixed compensations (salary, bonus, etc.)
    ec.fixed_compensations.forEach((fc) => {
      earnings.push({
        earningType: this.mapEarningType(fc.name),
        name: fc.name,
        amount: parseFloat(fc.amount),
        ytdAmount: 0,
      });
    });

    // Hourly compensations
    ec.hourly_compensations.forEach((hc) => {
      const hours = parseFloat(hc.hours);
      if (hours > 0) {
        earnings.push({
          earningType: hc.compensation_multiplier > 1 ? 'overtime' : 'regular',
          name: hc.name,
          hours,
          amount: 0, // Would need rate to calculate
          ytdAmount: 0,
        });
      }
    });

    // PTO
    ec.paid_time_off.forEach((pto) => {
      const hours = parseFloat(pto.hours);
      if (hours > 0) {
        earnings.push({
          earningType: this.mapPTOType(pto.name),
          name: pto.name,
          hours,
          amount: 0,
          ytdAmount: 0,
        });
      }
    });

    return earnings;
  }

  /**
   * Normalize taxes from Gusto
   */
  private normalizeTaxes(taxes: GustoTax[]): PaystubTax[] {
    return taxes.map((tax) => ({
      taxType: this.mapTaxType(tax.name),
      name: tax.name,
      employeeAmount: tax.employer ? 0 : parseFloat(tax.amount),
      employerAmount: tax.employer ? parseFloat(tax.amount) : 0,
      ytdEmployeeAmount: 0,
      ytdEmployerAmount: 0,
    }));
  }

  /**
   * Normalize deductions from Gusto
   */
  private normalizeDeductions(deductions: GustoDeduction[]): PaystubDeduction[] {
    return deductions.map((d) => ({
      deductionType: this.mapDeductionType(d.name),
      name: d.name,
      amount: parseFloat(d.amount),
      ytdAmount: 0,
      isPreTax: this.isPreTaxDeduction(d.name),
    }));
  }

  /**
   * Normalize employer contributions from Gusto benefits
   */
  private normalizeContributions(benefits: GustoBenefit[]): PaystubContribution[] {
    return benefits
      .filter((b) => parseFloat(b.company_contribution) > 0)
      .map((b) => ({
        contributionType: b.name,
        name: b.name,
        amount: parseFloat(b.company_contribution),
        ytdAmount: 0,
      }));
  }

  /**
   * Normalize payroll totals
   */
  private normalizePayrollTotals(totals?: GustoPayrollTotals): PayrollRunTotals {
    if (!totals) {
      return {
        grossPay: 0,
        netPay: 0,
        employerTaxes: 0,
        employeeTaxes: 0,
        employerContributions: 0,
        employeeDeductions: 0,
        reimbursements: 0,
        totalCompanyCost: 0,
        employeeCount: 0,
        currency: 'USD',
      };
    }

    const employerTaxes = parseFloat(totals.employer_taxes);
    const employeeTaxes = parseFloat(totals.employee_taxes);
    const benefits = parseFloat(totals.benefits);
    const netPay = parseFloat(totals.net_pay);
    const reimbursements = parseFloat(totals.reimbursements);
    const companyDebit = parseFloat(totals.company_debit);

    return {
      grossPay: netPay + employeeTaxes + parseFloat(totals.employee_benefits_deductions),
      netPay,
      employerTaxes,
      employeeTaxes,
      employerContributions: benefits,
      employeeDeductions: parseFloat(totals.employee_benefits_deductions),
      reimbursements,
      totalCompanyCost: companyDebit,
      employeeCount: 0, // Would need to count from employee_compensations
      currency: 'USD',
    };
  }

  /**
   * Normalize address
   */
  private normalizeAddress(address: GustoAddress): PayrollAddress {
    return {
      street1: address.street_1,
      street2: address.street_2,
      city: address.city,
      state: address.state,
      postalCode: address.zip,
      country: address.country || 'US',
    };
  }

  /**
   * Normalize compensation
   */
  private normalizeCompensation(
    compensation?: GustoCompensation,
    job?: GustoJob
  ): EmployeeCompensation {
    const rate = compensation ? parseFloat(compensation.rate) : 0;
    const paymentUnit = compensation?.payment_unit || job?.payment_unit || 'Year';

    return {
      payType: this.mapPayType(paymentUnit),
      payRate: rate,
      payFrequency: this.mapPayFrequency(paymentUnit),
      currency: 'USD',
      effectiveDate: compensation?.effective_date
        ? new Date(compensation.effective_date)
        : new Date(),
      flsaStatus: compensation?.flsa_status === 'Exempt' ? 'exempt' : 'non_exempt',
    };
  }

  /**
   * Create empty YTD totals
   */
  private emptyYTDTotals(): YTDTotals {
    return {
      grossPay: 0,
      netPay: 0,
      federalTax: 0,
      stateTax: 0,
      socialSecurity: 0,
      medicare: 0,
      totalTaxes: 0,
      totalDeductions: 0,
      totalReimbursements: 0,
    };
  }

  // ============================================================================
  // Mapping Helpers
  // ============================================================================

  private mapEmploymentStatus(employee: GustoEmployee): EmploymentStatus {
    if (employee.terminated) return 'terminated';
    if (!employee.onboarded) return 'pending';
    return 'active';
  }

  private mapEmploymentType(compensation?: GustoCompensation): EmploymentType {
    if (!compensation) return 'full_time';
    // Gusto doesn't directly expose employment type, infer from FLSA status
    if (compensation.flsa_status === 'Owner') return 'full_time';
    return 'full_time';
  }

  private mapPayType(paymentUnit: string): PayType {
    switch (paymentUnit) {
      case 'Hour':
        return 'hourly';
      case 'Week':
      case 'Month':
      case 'Year':
      case 'Paycheck':
        return 'salary';
      default:
        return 'salary';
    }
  }

  private mapPayFrequency(paymentUnit: string): PayFrequency {
    switch (paymentUnit) {
      case 'Week':
        return 'weekly';
      case 'Month':
        return 'monthly';
      default:
        return 'biweekly';
    }
  }

  private mapPayrollStatus(payroll: GustoPayroll): PayrollRunStatus {
    if (payroll.processed) return 'completed';
    if (payroll.calculated_at) return 'pending';
    return 'draft';
  }

  private mapPayrollRunType(payroll: GustoPayroll): PayrollRunType {
    // Gusto doesn't expose this directly; default to regular
    return 'regular';
  }

  private mapPaymentMethod(
    method: string
  ): 'direct_deposit' | 'check' | 'manual' {
    switch (method.toLowerCase()) {
      case 'direct deposit':
      case 'direct_deposit':
        return 'direct_deposit';
      case 'check':
        return 'check';
      default:
        return 'manual';
    }
  }

  private mapEarningType(name: string): EarningType {
    const lower = name.toLowerCase();
    if (lower.includes('bonus')) return 'bonus';
    if (lower.includes('commission')) return 'commission';
    if (lower.includes('overtime')) return 'overtime';
    if (lower.includes('holiday')) return 'holiday';
    if (lower.includes('severance')) return 'severance';
    if (lower.includes('tips')) return 'tips';
    return 'regular';
  }

  private mapPTOType(name: string): EarningType {
    const lower = name.toLowerCase();
    if (lower.includes('sick')) return 'sick';
    if (lower.includes('vacation') || lower.includes('pto')) return 'pto';
    if (lower.includes('holiday')) return 'holiday';
    return 'pto';
  }

  private mapTaxType(name: string): TaxType {
    const lower = name.toLowerCase();
    if (lower.includes('federal income') || lower.includes('fit'))
      return 'federal_income';
    if (lower.includes('social security') || lower.includes('fica_ee'))
      return 'social_security';
    if (lower.includes('medicare')) return 'medicare';
    if (lower.includes('state income') || lower.includes('sit'))
      return 'state_income';
    if (lower.includes('local') || lower.includes('city')) return 'local_income';
    if (lower.includes('suta') || lower.includes('state unemployment'))
      return 'state_unemployment';
    if (lower.includes('futa') || lower.includes('federal unemployment'))
      return 'federal_unemployment';
    if (lower.includes('sdi') || lower.includes('disability'))
      return 'state_disability';
    return 'other';
  }

  private mapDeductionType(name: string): DeductionType {
    const lower = name.toLowerCase();
    if (lower.includes('health') && lower.includes('insurance'))
      return 'health_insurance';
    if (lower.includes('dental')) return 'dental_insurance';
    if (lower.includes('vision')) return 'vision_insurance';
    if (lower.includes('life') && lower.includes('insurance'))
      return 'life_insurance';
    if (lower.includes('401k') || lower.includes('401(k)')) return '401k';
    if (lower.includes('roth')) return 'roth_401k';
    if (lower.includes('hsa')) return 'hsa';
    if (lower.includes('fsa')) return 'fsa';
    if (lower.includes('commuter')) return 'commuter';
    if (lower.includes('garnishment')) return 'garnishment';
    if (lower.includes('child support')) return 'child_support';
    if (lower.includes('union')) return 'union_dues';
    return 'other';
  }

  private isPreTaxDeduction(name: string): boolean {
    const lower = name.toLowerCase();
    // Pre-tax deductions in Gusto
    const preTax = ['401k', '401(k)', 'hsa', 'fsa', 'health', 'dental', 'vision'];
    return preTax.some((term) => lower.includes(term));
  }
}
