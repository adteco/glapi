import { BaseService } from './base-service';
import { ServiceError, PaginatedResult } from '../types';
import { AccountingListRepository } from '@glapi/database';
import {
  CreatePaymentTermsInput,
  UpdatePaymentTermsInput,
  CreatePaymentMethodInput,
  UpdatePaymentMethodInput,
  CreateChargeTypeInput,
  UpdateChargeTypeInput,
  AssignCustomerAccountingListInput,
  PaymentTerms,
  PaymentMethod,
  ChargeType,
  CustomerAccountingList,
  DueDateCalculation,
  DiscountCalculation,
  AccountingListQueryInput,
  DueDateType,
} from '@glapi/types';

const accountingListRepository = new AccountingListRepository();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get end of month for a date
 */
function getEndOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Get a specific day of the month (next occurrence)
 */
function getNextDayOfMonth(date: Date, dayOfMonth: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), dayOfMonth);

  // If the day has passed this month, go to next month
  if (result <= date) {
    result.setMonth(result.getMonth() + 1);
  }

  // Handle months with fewer days
  const maxDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  if (dayOfMonth > maxDay) {
    result.setDate(maxDay);
  }

  return result;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class AccountingListService extends BaseService {
  // ============================================================================
  // PAYMENT TERMS METHODS
  // ============================================================================

  /**
   * List payment terms
   */
  async listPaymentTerms(
    params: Partial<AccountingListQueryInput> = {}
  ): Promise<PaginatedResult<PaymentTerms>> {
    const organizationId = this.requireOrganizationContext();
    const { page = 1, limit = 50, activeOnly, search } = params;

    const result = await accountingListRepository.listPaymentTerms({
      organizationId,
      activeOnly,
      search,
      page,
      limit,
    });

    // Transform to service layer types
    const data: PaymentTerms[] = result.data.map((item) => ({
      id: item.accountingList.id,
      organizationId: item.accountingList.organizationId,
      listType: 'payment_terms' as const,
      code: item.accountingList.code,
      name: item.accountingList.name,
      description: item.accountingList.description,
      isActive: item.accountingList.isActive,
      isDefault: item.accountingList.isDefault,
      sortOrder: item.accountingList.sortOrder,
      createdAt: item.accountingList.createdAt,
      updatedAt: item.accountingList.updatedAt,
      details: {
        id: item.details.id,
        dueDateType: item.details.dueDateType as DueDateType,
        netDays: item.details.netDays,
        dayOfMonth: item.details.dayOfMonth,
        discountDays: item.details.discountDays,
        discountPercent: parseFloat(String(item.details.discountPercent)),
      },
    }));

    return this.createPaginatedResult(data, result.total, result.page, result.limit);
  }

  /**
   * Get payment terms by ID
   */
  async getPaymentTerms(id: string): Promise<PaymentTerms> {
    const organizationId = this.requireOrganizationContext();

    const result = await accountingListRepository.getPaymentTermsById(id, organizationId);

    if (!result) {
      throw new ServiceError('Payment terms not found', 'PAYMENT_TERMS_NOT_FOUND', 404);
    }

    return {
      id: result.accountingList.id,
      organizationId: result.accountingList.organizationId,
      listType: 'payment_terms' as const,
      code: result.accountingList.code,
      name: result.accountingList.name,
      description: result.accountingList.description,
      isActive: result.accountingList.isActive,
      isDefault: result.accountingList.isDefault,
      sortOrder: result.accountingList.sortOrder,
      createdAt: result.accountingList.createdAt,
      updatedAt: result.accountingList.updatedAt,
      details: {
        id: result.details.id,
        dueDateType: result.details.dueDateType as DueDateType,
        netDays: result.details.netDays,
        dayOfMonth: result.details.dayOfMonth,
        discountDays: result.details.discountDays,
        discountPercent: parseFloat(String(result.details.discountPercent)),
      },
    };
  }

  /**
   * Create payment terms
   */
  async createPaymentTerms(input: CreatePaymentTermsInput): Promise<PaymentTerms> {
    const organizationId = this.requireOrganizationContext();

    // Check for duplicate code
    const existing = await accountingListRepository.findByCode(
      input.code,
      'payment_terms',
      organizationId
    );

    if (existing) {
      throw new ServiceError(
        `Payment terms with code "${input.code}" already exists`,
        'DUPLICATE_CODE',
        400
      );
    }

    const result = await accountingListRepository.createPaymentTerms(
      {
        organizationId,
        code: input.code,
        name: input.name,
        description: input.description,
        isActive: input.isActive ?? true,
        isDefault: input.isDefault ?? false,
        sortOrder: input.sortOrder ?? 0,
      },
      {
        dueDateType: input.dueDateType ?? 'net_days',
        netDays: input.netDays ?? 30,
        dayOfMonth: input.dayOfMonth,
        discountDays: input.discountDays ?? 0,
        discountPercent: String(input.discountPercent ?? 0),
      }
    );

    return this.getPaymentTerms(result.accountingList.id);
  }

  /**
   * Update payment terms
   */
  async updatePaymentTerms(id: string, input: UpdatePaymentTermsInput): Promise<PaymentTerms> {
    const organizationId = this.requireOrganizationContext();

    // Check exists
    const existing = await accountingListRepository.getPaymentTermsById(id, organizationId);
    if (!existing) {
      throw new ServiceError('Payment terms not found', 'PAYMENT_TERMS_NOT_FOUND', 404);
    }

    // Check for duplicate code if changing
    if (input.code && input.code !== existing.accountingList.code) {
      const duplicate = await accountingListRepository.findByCode(
        input.code,
        'payment_terms',
        organizationId
      );
      if (duplicate) {
        throw new ServiceError(
          `Payment terms with code "${input.code}" already exists`,
          'DUPLICATE_CODE',
          400
        );
      }
    }

    // Separate base and details fields
    const baseData: any = {};
    const detailsData: any = {};

    if (input.code !== undefined) baseData.code = input.code;
    if (input.name !== undefined) baseData.name = input.name;
    if (input.description !== undefined) baseData.description = input.description;
    if (input.isActive !== undefined) baseData.isActive = input.isActive;
    if (input.isDefault !== undefined) baseData.isDefault = input.isDefault;
    if (input.sortOrder !== undefined) baseData.sortOrder = input.sortOrder;

    if (input.dueDateType !== undefined) detailsData.dueDateType = input.dueDateType;
    if (input.netDays !== undefined) detailsData.netDays = input.netDays;
    if (input.dayOfMonth !== undefined) detailsData.dayOfMonth = input.dayOfMonth;
    if (input.discountDays !== undefined) detailsData.discountDays = input.discountDays;
    if (input.discountPercent !== undefined) detailsData.discountPercent = String(input.discountPercent);

    await accountingListRepository.updatePaymentTerms(id, organizationId, baseData, detailsData);

    return this.getPaymentTerms(id);
  }

  /**
   * Delete payment terms (soft delete)
   */
  async deletePaymentTerms(id: string): Promise<{ success: boolean }> {
    const organizationId = this.requireOrganizationContext();

    const existing = await accountingListRepository.getPaymentTermsById(id, organizationId);
    if (!existing) {
      throw new ServiceError('Payment terms not found', 'PAYMENT_TERMS_NOT_FOUND', 404);
    }

    await accountingListRepository.deletePaymentTerms(id, organizationId);

    return { success: true };
  }

  // ============================================================================
  // PAYMENT METHODS METHODS
  // ============================================================================

  /**
   * List payment methods
   */
  async listPaymentMethods(
    params: Partial<AccountingListQueryInput> = {}
  ): Promise<PaginatedResult<PaymentMethod>> {
    const organizationId = this.requireOrganizationContext();
    const { page = 1, limit = 50, activeOnly, search } = params;

    const result = await accountingListRepository.listPaymentMethods({
      organizationId,
      activeOnly,
      search,
      page,
      limit,
    });

    const data: PaymentMethod[] = result.data.map((item) => ({
      id: item.accountingList.id,
      organizationId: item.accountingList.organizationId,
      listType: 'payment_method' as const,
      code: item.accountingList.code,
      name: item.accountingList.name,
      description: item.accountingList.description,
      isActive: item.accountingList.isActive,
      isDefault: item.accountingList.isDefault,
      sortOrder: item.accountingList.sortOrder,
      createdAt: item.accountingList.createdAt,
      updatedAt: item.accountingList.updatedAt,
      details: {
        id: item.details.id,
        methodType: item.details.methodType,
        depositAccountId: item.details.depositAccountId,
        requiresApproval: item.details.requiresApproval,
        processingFeePercent: item.details.processingFeePercent
          ? parseFloat(String(item.details.processingFeePercent))
          : null,
        processingFeeFixed: item.details.processingFeeFixed
          ? parseFloat(String(item.details.processingFeeFixed))
          : null,
        depositAccount: item.depositAccount
          ? { id: item.depositAccount.id, code: item.depositAccount.accountNumber, name: item.depositAccount.accountName }
          : undefined,
      },
    }));

    return this.createPaginatedResult(data, result.total, result.page, result.limit);
  }

  /**
   * Get payment method by ID
   */
  async getPaymentMethod(id: string): Promise<PaymentMethod> {
    const organizationId = this.requireOrganizationContext();

    const result = await accountingListRepository.getPaymentMethodById(id, organizationId);

    if (!result) {
      throw new ServiceError('Payment method not found', 'PAYMENT_METHOD_NOT_FOUND', 404);
    }

    return {
      id: result.accountingList.id,
      organizationId: result.accountingList.organizationId,
      listType: 'payment_method' as const,
      code: result.accountingList.code,
      name: result.accountingList.name,
      description: result.accountingList.description,
      isActive: result.accountingList.isActive,
      isDefault: result.accountingList.isDefault,
      sortOrder: result.accountingList.sortOrder,
      createdAt: result.accountingList.createdAt,
      updatedAt: result.accountingList.updatedAt,
      details: {
        id: result.details.id,
        methodType: result.details.methodType,
        depositAccountId: result.details.depositAccountId,
        requiresApproval: result.details.requiresApproval,
        processingFeePercent: result.details.processingFeePercent
          ? parseFloat(String(result.details.processingFeePercent))
          : null,
        processingFeeFixed: result.details.processingFeeFixed
          ? parseFloat(String(result.details.processingFeeFixed))
          : null,
        depositAccount: result.depositAccount
          ? { id: result.depositAccount.id, code: result.depositAccount.accountNumber, name: result.depositAccount.accountName }
          : undefined,
      },
    };
  }

  /**
   * Create payment method
   */
  async createPaymentMethod(input: CreatePaymentMethodInput): Promise<PaymentMethod> {
    const organizationId = this.requireOrganizationContext();

    const existing = await accountingListRepository.findByCode(
      input.code,
      'payment_method',
      organizationId
    );

    if (existing) {
      throw new ServiceError(
        `Payment method with code "${input.code}" already exists`,
        'DUPLICATE_CODE',
        400
      );
    }

    const result = await accountingListRepository.createPaymentMethod(
      {
        organizationId,
        code: input.code,
        name: input.name,
        description: input.description,
        isActive: input.isActive ?? true,
        isDefault: input.isDefault ?? false,
        sortOrder: input.sortOrder ?? 0,
      },
      {
        methodType: input.methodType,
        depositAccountId: input.depositAccountId,
        requiresApproval: input.requiresApproval ?? false,
        processingFeePercent: input.processingFeePercent != null
          ? String(input.processingFeePercent)
          : null,
        processingFeeFixed: input.processingFeeFixed != null
          ? String(input.processingFeeFixed)
          : null,
      }
    );

    return this.getPaymentMethod(result.accountingList.id);
  }

  /**
   * Update payment method
   */
  async updatePaymentMethod(id: string, input: UpdatePaymentMethodInput): Promise<PaymentMethod> {
    const organizationId = this.requireOrganizationContext();

    const existing = await accountingListRepository.getPaymentMethodById(id, organizationId);
    if (!existing) {
      throw new ServiceError('Payment method not found', 'PAYMENT_METHOD_NOT_FOUND', 404);
    }

    if (input.code && input.code !== existing.accountingList.code) {
      const duplicate = await accountingListRepository.findByCode(
        input.code,
        'payment_method',
        organizationId
      );
      if (duplicate) {
        throw new ServiceError(
          `Payment method with code "${input.code}" already exists`,
          'DUPLICATE_CODE',
          400
        );
      }
    }

    const baseData: any = {};
    const detailsData: any = {};

    if (input.code !== undefined) baseData.code = input.code;
    if (input.name !== undefined) baseData.name = input.name;
    if (input.description !== undefined) baseData.description = input.description;
    if (input.isActive !== undefined) baseData.isActive = input.isActive;
    if (input.isDefault !== undefined) baseData.isDefault = input.isDefault;
    if (input.sortOrder !== undefined) baseData.sortOrder = input.sortOrder;

    if (input.methodType !== undefined) detailsData.methodType = input.methodType;
    if (input.depositAccountId !== undefined) detailsData.depositAccountId = input.depositAccountId;
    if (input.requiresApproval !== undefined) detailsData.requiresApproval = input.requiresApproval;
    if (input.processingFeePercent !== undefined) {
      detailsData.processingFeePercent = input.processingFeePercent != null
        ? String(input.processingFeePercent)
        : null;
    }
    if (input.processingFeeFixed !== undefined) {
      detailsData.processingFeeFixed = input.processingFeeFixed != null
        ? String(input.processingFeeFixed)
        : null;
    }

    await accountingListRepository.updatePaymentMethod(id, organizationId, baseData, detailsData);

    return this.getPaymentMethod(id);
  }

  /**
   * Delete payment method (soft delete)
   */
  async deletePaymentMethod(id: string): Promise<{ success: boolean }> {
    const organizationId = this.requireOrganizationContext();

    const existing = await accountingListRepository.getPaymentMethodById(id, organizationId);
    if (!existing) {
      throw new ServiceError('Payment method not found', 'PAYMENT_METHOD_NOT_FOUND', 404);
    }

    await accountingListRepository.deletePaymentMethod(id, organizationId);

    return { success: true };
  }

  // ============================================================================
  // CHARGE TYPES METHODS
  // ============================================================================

  /**
   * List charge types
   */
  async listChargeTypes(
    params: Partial<AccountingListQueryInput> = {}
  ): Promise<PaginatedResult<ChargeType>> {
    const organizationId = this.requireOrganizationContext();
    const { page = 1, limit = 50, activeOnly, search } = params;

    const result = await accountingListRepository.listChargeTypes({
      organizationId,
      activeOnly,
      search,
      page,
      limit,
    });

    const data: ChargeType[] = result.data.map((item) => ({
      id: item.accountingList.id,
      organizationId: item.accountingList.organizationId,
      listType: 'charge_type' as const,
      code: item.accountingList.code,
      name: item.accountingList.name,
      description: item.accountingList.description,
      isActive: item.accountingList.isActive,
      isDefault: item.accountingList.isDefault,
      sortOrder: item.accountingList.sortOrder,
      createdAt: item.accountingList.createdAt,
      updatedAt: item.accountingList.updatedAt,
      details: {
        id: item.details.id,
        chargeCategory: item.details.chargeCategory,
        incomeAccountId: item.details.incomeAccountId,
        expenseAccountId: item.details.expenseAccountId,
        isTaxable: item.details.isTaxable,
        defaultTaxCodeId: item.details.defaultTaxCodeId,
        incomeAccount: item.incomeAccount
          ? { id: item.incomeAccount.id, code: item.incomeAccount.accountNumber, name: item.incomeAccount.accountName }
          : undefined,
        expenseAccount: item.expenseAccount
          ? { id: item.expenseAccount.id, code: item.expenseAccount.accountNumber, name: item.expenseAccount.accountName }
          : undefined,
      },
    }));

    return this.createPaginatedResult(data, result.total, result.page, result.limit);
  }

  /**
   * Get charge type by ID
   */
  async getChargeType(id: string): Promise<ChargeType> {
    const organizationId = this.requireOrganizationContext();

    const result = await accountingListRepository.getChargeTypeById(id, organizationId);

    if (!result) {
      throw new ServiceError('Charge type not found', 'CHARGE_TYPE_NOT_FOUND', 404);
    }

    return {
      id: result.accountingList.id,
      organizationId: result.accountingList.organizationId,
      listType: 'charge_type' as const,
      code: result.accountingList.code,
      name: result.accountingList.name,
      description: result.accountingList.description,
      isActive: result.accountingList.isActive,
      isDefault: result.accountingList.isDefault,
      sortOrder: result.accountingList.sortOrder,
      createdAt: result.accountingList.createdAt,
      updatedAt: result.accountingList.updatedAt,
      details: {
        id: result.details.id,
        chargeCategory: result.details.chargeCategory,
        incomeAccountId: result.details.incomeAccountId,
        expenseAccountId: result.details.expenseAccountId,
        isTaxable: result.details.isTaxable,
        defaultTaxCodeId: result.details.defaultTaxCodeId,
        incomeAccount: result.incomeAccount
          ? { id: result.incomeAccount.id, code: result.incomeAccount.accountNumber, name: result.incomeAccount.accountName }
          : undefined,
        expenseAccount: result.expenseAccount
          ? { id: result.expenseAccount.id, code: result.expenseAccount.accountNumber, name: result.expenseAccount.accountName }
          : undefined,
      },
    };
  }

  /**
   * Create charge type
   */
  async createChargeType(input: CreateChargeTypeInput): Promise<ChargeType> {
    const organizationId = this.requireOrganizationContext();

    const existing = await accountingListRepository.findByCode(
      input.code,
      'charge_type',
      organizationId
    );

    if (existing) {
      throw new ServiceError(
        `Charge type with code "${input.code}" already exists`,
        'DUPLICATE_CODE',
        400
      );
    }

    const result = await accountingListRepository.createChargeType(
      {
        organizationId,
        code: input.code,
        name: input.name,
        description: input.description,
        isActive: input.isActive ?? true,
        isDefault: input.isDefault ?? false,
        sortOrder: input.sortOrder ?? 0,
      },
      {
        chargeCategory: input.chargeCategory,
        incomeAccountId: input.incomeAccountId,
        expenseAccountId: input.expenseAccountId,
        isTaxable: input.isTaxable ?? true,
        defaultTaxCodeId: input.defaultTaxCodeId,
      }
    );

    return this.getChargeType(result.accountingList.id);
  }

  /**
   * Update charge type
   */
  async updateChargeType(id: string, input: UpdateChargeTypeInput): Promise<ChargeType> {
    const organizationId = this.requireOrganizationContext();

    const existing = await accountingListRepository.getChargeTypeById(id, organizationId);
    if (!existing) {
      throw new ServiceError('Charge type not found', 'CHARGE_TYPE_NOT_FOUND', 404);
    }

    if (input.code && input.code !== existing.accountingList.code) {
      const duplicate = await accountingListRepository.findByCode(
        input.code,
        'charge_type',
        organizationId
      );
      if (duplicate) {
        throw new ServiceError(
          `Charge type with code "${input.code}" already exists`,
          'DUPLICATE_CODE',
          400
        );
      }
    }

    const baseData: any = {};
    const detailsData: any = {};

    if (input.code !== undefined) baseData.code = input.code;
    if (input.name !== undefined) baseData.name = input.name;
    if (input.description !== undefined) baseData.description = input.description;
    if (input.isActive !== undefined) baseData.isActive = input.isActive;
    if (input.isDefault !== undefined) baseData.isDefault = input.isDefault;
    if (input.sortOrder !== undefined) baseData.sortOrder = input.sortOrder;

    if (input.chargeCategory !== undefined) detailsData.chargeCategory = input.chargeCategory;
    if (input.incomeAccountId !== undefined) detailsData.incomeAccountId = input.incomeAccountId;
    if (input.expenseAccountId !== undefined) detailsData.expenseAccountId = input.expenseAccountId;
    if (input.isTaxable !== undefined) detailsData.isTaxable = input.isTaxable;
    if (input.defaultTaxCodeId !== undefined) detailsData.defaultTaxCodeId = input.defaultTaxCodeId;

    await accountingListRepository.updateChargeType(id, organizationId, baseData, detailsData);

    return this.getChargeType(id);
  }

  /**
   * Delete charge type (soft delete)
   */
  async deleteChargeType(id: string): Promise<{ success: boolean }> {
    const organizationId = this.requireOrganizationContext();

    const existing = await accountingListRepository.getChargeTypeById(id, organizationId);
    if (!existing) {
      throw new ServiceError('Charge type not found', 'CHARGE_TYPE_NOT_FOUND', 404);
    }

    await accountingListRepository.deleteChargeType(id, organizationId);

    return { success: true };
  }

  // ============================================================================
  // CUSTOMER ASSIGNMENT METHODS
  // ============================================================================

  /**
   * Assign accounting list to customer
   */
  async assignToCustomer(input: AssignCustomerAccountingListInput): Promise<CustomerAccountingList> {
    const organizationId = this.requireOrganizationContext();

    // Verify accounting list exists and belongs to organization
    const accountingList = await accountingListRepository.findById(
      input.accountingListId,
      organizationId
    );

    if (!accountingList) {
      throw new ServiceError('Accounting list not found', 'ACCOUNTING_LIST_NOT_FOUND', 404);
    }

    const result = await accountingListRepository.assignToCustomer({
      customerId: input.customerId,
      accountingListId: input.accountingListId,
      priority: input.priority ?? 1,
      effectiveDate: input.effectiveDate
        ? (input.effectiveDate instanceof Date
            ? input.effectiveDate.toISOString().split('T')[0]
            : input.effectiveDate)
        : null,
      expirationDate: input.expirationDate
        ? (input.expirationDate instanceof Date
            ? input.expirationDate.toISOString().split('T')[0]
            : input.expirationDate)
        : null,
    });

    return {
      id: result.id,
      customerId: result.customerId,
      accountingListId: result.accountingListId,
      priority: result.priority,
      effectiveDate: result.effectiveDate,
      expirationDate: result.expirationDate,
      createdAt: result.createdAt,
    };
  }

  /**
   * Remove accounting list from customer
   */
  async removeFromCustomer(
    customerId: string,
    accountingListId: string
  ): Promise<{ success: boolean }> {
    await accountingListRepository.removeFromCustomer(customerId, accountingListId);
    return { success: true };
  }

  /**
   * Get customer's accounting list assignments
   */
  async getCustomerAccountingLists(customerId: string): Promise<{
    paymentTerms: CustomerAccountingList[];
    paymentMethods: CustomerAccountingList[];
    chargeTypes: CustomerAccountingList[];
  }> {
    const [paymentTerms, paymentMethods, chargeTypes] = await Promise.all([
      accountingListRepository.getCustomerAccountingLists(customerId, 'payment_terms'),
      accountingListRepository.getCustomerAccountingLists(customerId, 'payment_method'),
      accountingListRepository.getCustomerAccountingLists(customerId, 'charge_type'),
    ]);

    const mapAssignment = (a: any): CustomerAccountingList => ({
      id: a.id,
      customerId: a.customerId,
      accountingListId: a.accountingListId,
      priority: a.priority,
      effectiveDate: a.effectiveDate,
      expirationDate: a.expirationDate,
      createdAt: a.createdAt,
      accountingList: a.accountingList,
    });

    return {
      paymentTerms: paymentTerms.map(mapAssignment),
      paymentMethods: paymentMethods.map(mapAssignment),
      chargeTypes: chargeTypes.map(mapAssignment),
    };
  }

  /**
   * Get effective payment terms for a customer
   */
  async getEffectivePaymentTerms(
    customerId: string,
    asOfDate?: Date
  ): Promise<PaymentTerms | null> {
    const organizationId = this.requireOrganizationContext();

    const result = await accountingListRepository.getEffectivePaymentTerms(
      customerId,
      organizationId,
      asOfDate
    );

    if (!result) {
      return null;
    }

    return {
      id: result.accountingList.id,
      organizationId: result.accountingList.organizationId,
      listType: 'payment_terms' as const,
      code: result.accountingList.code,
      name: result.accountingList.name,
      description: result.accountingList.description,
      isActive: result.accountingList.isActive,
      isDefault: result.accountingList.isDefault,
      sortOrder: result.accountingList.sortOrder,
      createdAt: result.accountingList.createdAt,
      updatedAt: result.accountingList.updatedAt,
      details: {
        id: result.details.id,
        dueDateType: result.details.dueDateType as DueDateType,
        netDays: result.details.netDays,
        dayOfMonth: result.details.dayOfMonth,
        discountDays: result.details.discountDays,
        discountPercent: parseFloat(String(result.details.discountPercent)),
      },
    };
  }

  // ============================================================================
  // CALCULATION METHODS
  // ============================================================================

  /**
   * Calculate due date based on payment terms
   */
  async calculateDueDate(invoiceDate: Date, paymentTermsId: string): Promise<DueDateCalculation> {
    const organizationId = this.requireOrganizationContext();

    const terms = await accountingListRepository.getPaymentTermsById(paymentTermsId, organizationId);

    if (!terms) {
      throw new ServiceError('Payment terms not found', 'PAYMENT_TERMS_NOT_FOUND', 404);
    }

    const { dueDateType, netDays, dayOfMonth, discountDays, discountPercent } = terms.details;

    let dueDate: Date;

    switch (dueDateType) {
      case 'net_days':
        // Standard: invoice date + net days
        dueDate = addDays(invoiceDate, netDays);
        break;

      case 'day_of_month':
        // Due on specific day of month
        if (dayOfMonth) {
          dueDate = getNextDayOfMonth(invoiceDate, dayOfMonth);
        } else {
          // Fallback to net days if day not specified
          dueDate = addDays(invoiceDate, netDays);
        }
        break;

      case 'end_of_month':
        // End of month + net days
        const endOfMonth = getEndOfMonth(invoiceDate);
        dueDate = addDays(endOfMonth, netDays);
        break;

      default:
        dueDate = addDays(invoiceDate, netDays);
    }

    // Calculate discount date
    let discountDate: Date | null = null;
    let discountAmount: number | null = null;
    const discountPercentNum = parseFloat(String(discountPercent));

    if (discountDays > 0 && discountPercentNum > 0) {
      discountDate = addDays(invoiceDate, discountDays);
    }

    return {
      dueDate,
      discountDate,
      discountAmount, // Amount would need to be calculated from invoice total
      discountPercent: discountPercentNum,
      netDays,
      dueDateType: dueDateType as DueDateType,
    };
  }

  /**
   * Calculate early payment discount
   */
  async calculateEarlyPaymentDiscount(
    amount: number,
    paymentTermsId: string,
    invoiceDate: Date,
    paymentDate: Date
  ): Promise<DiscountCalculation> {
    const organizationId = this.requireOrganizationContext();

    const terms = await accountingListRepository.getPaymentTermsById(paymentTermsId, organizationId);

    if (!terms) {
      throw new ServiceError('Payment terms not found', 'PAYMENT_TERMS_NOT_FOUND', 404);
    }

    const { discountDays, discountPercent } = terms.details;
    const discountPercentNum = parseFloat(String(discountPercent));

    // Calculate discount deadline
    let discountDeadline: Date | null = null;
    let daysUntilDeadline: number | null = null;

    if (discountDays > 0 && discountPercentNum > 0) {
      discountDeadline = addDays(invoiceDate, discountDays);
      const diffTime = discountDeadline.getTime() - paymentDate.getTime();
      daysUntilDeadline = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Check if payment qualifies for discount
    const discountApplied =
      discountDeadline !== null && paymentDate <= discountDeadline && discountPercentNum > 0;

    const discountAmount = discountApplied ? (amount * discountPercentNum) / 100 : 0;
    const netAmount = amount - discountAmount;

    return {
      originalAmount: amount,
      discountAmount,
      netAmount,
      discountApplied,
      discountPercent: discountPercentNum,
      discountDeadline,
      daysUntilDeadline,
    };
  }

  /**
   * Get customers assigned to an accounting list
   */
  async getCustomersForAccountingList(
    accountingListId: string,
    page = 1,
    limit = 50
  ): Promise<PaginatedResult<CustomerAccountingList>> {
    const organizationId = this.requireOrganizationContext();

    // Verify accounting list exists
    const accountingList = await accountingListRepository.findById(accountingListId, organizationId);
    if (!accountingList) {
      throw new ServiceError('Accounting list not found', 'ACCOUNTING_LIST_NOT_FOUND', 404);
    }

    const result = await accountingListRepository.getCustomersForAccountingList(
      accountingListId,
      page,
      limit
    );

    const data: CustomerAccountingList[] = result.data.map((a) => ({
      id: a.id,
      customerId: a.customerId,
      accountingListId: a.accountingListId,
      priority: a.priority,
      effectiveDate: a.effectiveDate,
      expirationDate: a.expirationDate,
      createdAt: a.createdAt,
    }));

    return this.createPaginatedResult(data, result.total, page, limit);
  }
}
