import { and, eq, gte, lte, or, isNull, desc, asc, sql, ilike } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  accountingLists,
  paymentTermsDetails,
  paymentMethodsDetails,
  chargeTypesDetails,
  customerAccountingLists,
  type AccountingList,
  type NewAccountingList,
  type PaymentTermsDetail,
  type NewPaymentTermsDetail,
  type PaymentMethodsDetail,
  type NewPaymentMethodsDetail,
  type ChargeTypesDetail,
  type NewChargeTypesDetail,
  type CustomerAccountingList,
  type NewCustomerAccountingList,
  type AccountingListType,
} from '../db/schema/accounting-lists';
import { entities } from '../db/schema/entities';
import { accounts } from '../db/schema/accounts';

// ============================================================================
// INTERFACES
// ============================================================================

export interface AccountingListQueryParams {
  organizationId: string;
  listType: AccountingListType;
  activeOnly?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaymentTermsWithDetailsResult {
  accountingList: AccountingList;
  details: PaymentTermsDetail;
}

export interface PaymentMethodWithDetailsResult {
  accountingList: AccountingList;
  details: PaymentMethodsDetail;
  depositAccount?: { id: string; accountNumber: string; accountName: string } | null;
}

export interface ChargeTypeWithDetailsResult {
  accountingList: AccountingList;
  details: ChargeTypesDetail;
  incomeAccount?: { id: string; accountNumber: string; accountName: string } | null;
  expenseAccount?: { id: string; accountNumber: string; accountName: string } | null;
}

export interface CustomerAccountingListWithDetails extends CustomerAccountingList {
  accountingList: AccountingList;
}

// ============================================================================
// REPOSITORY CLASS
// ============================================================================

export class AccountingListRepository extends BaseRepository {
  // ============================================================================
  // BASE ACCOUNTING LIST METHODS
  // ============================================================================

  /**
   * Find all accounting lists by type for an organization
   */
  async findByOrganizationAndType(params: AccountingListQueryParams) {
    const { organizationId, listType, activeOnly = true, search, page = 1, limit = 50 } = params;

    const conditions = [
      eq(accountingLists.organizationId, organizationId),
      eq(accountingLists.listType, listType),
    ];

    if (activeOnly) {
      conditions.push(eq(accountingLists.isActive, true));
    }

    if (search) {
      conditions.push(
        or(
          ilike(accountingLists.code, `%${search}%`),
          ilike(accountingLists.name, `%${search}%`)
        )!
      );
    }

    const offset = (page - 1) * limit;

    const results = await this.db
      .select()
      .from(accountingLists)
      .where(and(...conditions))
      .orderBy(asc(accountingLists.sortOrder), asc(accountingLists.name))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(accountingLists)
      .where(and(...conditions));

    return {
      data: results,
      total: Number(countResult[0]?.count || 0),
      page,
      limit,
    };
  }

  /**
   * Find accounting list by ID
   */
  async findById(id: string, organizationId: string) {
    const results = await this.db
      .select()
      .from(accountingLists)
      .where(
        and(
          eq(accountingLists.id, id),
          eq(accountingLists.organizationId, organizationId)
        )
      );

    return results[0] || null;
  }

  /**
   * Find accounting list by code and type
   */
  async findByCode(code: string, listType: AccountingListType, organizationId: string) {
    const results = await this.db
      .select()
      .from(accountingLists)
      .where(
        and(
          eq(accountingLists.code, code),
          eq(accountingLists.listType, listType),
          eq(accountingLists.organizationId, organizationId)
        )
      );

    return results[0] || null;
  }

  /**
   * Get the default accounting list for a type
   */
  async getDefault(organizationId: string, listType: AccountingListType) {
    const results = await this.db
      .select()
      .from(accountingLists)
      .where(
        and(
          eq(accountingLists.organizationId, organizationId),
          eq(accountingLists.listType, listType),
          eq(accountingLists.isDefault, true),
          eq(accountingLists.isActive, true)
        )
      );

    return results[0] || null;
  }

  /**
   * Clear default flag for a list type
   */
  private async clearDefaultFlag(organizationId: string, listType: AccountingListType) {
    await this.db
      .update(accountingLists)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(accountingLists.organizationId, organizationId),
          eq(accountingLists.listType, listType),
          eq(accountingLists.isDefault, true)
        )
      );
  }

  // ============================================================================
  // PAYMENT TERMS METHODS
  // ============================================================================

  /**
   * Create payment terms with details
   */
  async createPaymentTerms(
    baseData: Omit<NewAccountingList, 'listType'>,
    detailsData: Omit<NewPaymentTermsDetail, 'accountingListId'>
  ): Promise<PaymentTermsWithDetailsResult> {
    // Clear default if needed
    if (baseData.isDefault) {
      await this.clearDefaultFlag(baseData.organizationId, 'payment_terms');
    }

    // Create base record
    const [accountingList] = await this.db
      .insert(accountingLists)
      .values({
        ...baseData,
        listType: 'payment_terms',
      })
      .returning();

    // Create details record
    const [details] = await this.db
      .insert(paymentTermsDetails)
      .values({
        ...detailsData,
        accountingListId: accountingList.id,
      })
      .returning();

    return { accountingList, details };
  }

  /**
   * Get payment terms with details
   */
  async getPaymentTermsById(id: string, organizationId: string): Promise<PaymentTermsWithDetailsResult | null> {
    const results = await this.db
      .select({
        accountingList: accountingLists,
        details: paymentTermsDetails,
      })
      .from(accountingLists)
      .innerJoin(paymentTermsDetails, eq(paymentTermsDetails.accountingListId, accountingLists.id))
      .where(
        and(
          eq(accountingLists.id, id),
          eq(accountingLists.organizationId, organizationId),
          eq(accountingLists.listType, 'payment_terms')
        )
      );

    return results[0] || null;
  }

  /**
   * List all payment terms with details
   */
  async listPaymentTerms(params: Omit<AccountingListQueryParams, 'listType'>): Promise<{
    data: PaymentTermsWithDetailsResult[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { organizationId, activeOnly = true, search, page = 1, limit = 50 } = params;

    const conditions = [
      eq(accountingLists.organizationId, organizationId),
      eq(accountingLists.listType, 'payment_terms'),
    ];

    if (activeOnly) {
      conditions.push(eq(accountingLists.isActive, true));
    }

    if (search) {
      conditions.push(
        or(
          ilike(accountingLists.code, `%${search}%`),
          ilike(accountingLists.name, `%${search}%`)
        )!
      );
    }

    const offset = (page - 1) * limit;

    const results = await this.db
      .select({
        accountingList: accountingLists,
        details: paymentTermsDetails,
      })
      .from(accountingLists)
      .innerJoin(paymentTermsDetails, eq(paymentTermsDetails.accountingListId, accountingLists.id))
      .where(and(...conditions))
      .orderBy(asc(accountingLists.sortOrder), asc(accountingLists.name))
      .limit(limit)
      .offset(offset);

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(accountingLists)
      .where(and(...conditions));

    return {
      data: results,
      total: Number(countResult[0]?.count || 0),
      page,
      limit,
    };
  }

  /**
   * Update payment terms with details
   */
  async updatePaymentTerms(
    id: string,
    organizationId: string,
    baseData: Partial<NewAccountingList>,
    detailsData: Partial<NewPaymentTermsDetail>
  ): Promise<PaymentTermsWithDetailsResult | null> {
    // Clear default if needed
    if (baseData.isDefault) {
      await this.clearDefaultFlag(organizationId, 'payment_terms');
    }

    // Update base record
    if (Object.keys(baseData).length > 0) {
      await this.db
        .update(accountingLists)
        .set({ ...baseData, updatedAt: new Date() })
        .where(
          and(
            eq(accountingLists.id, id),
            eq(accountingLists.organizationId, organizationId),
            eq(accountingLists.listType, 'payment_terms')
          )
        );
    }

    // Update details record
    if (Object.keys(detailsData).length > 0) {
      await this.db
        .update(paymentTermsDetails)
        .set({ ...detailsData, updatedAt: new Date() })
        .where(eq(paymentTermsDetails.accountingListId, id));
    }

    return this.getPaymentTermsById(id, organizationId);
  }

  /**
   * Delete payment terms (soft delete via isActive)
   */
  async deletePaymentTerms(id: string, organizationId: string): Promise<boolean> {
    const result = await this.db
      .update(accountingLists)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(accountingLists.id, id),
          eq(accountingLists.organizationId, organizationId),
          eq(accountingLists.listType, 'payment_terms')
        )
      );

    return true;
  }

  // ============================================================================
  // PAYMENT METHODS METHODS
  // ============================================================================

  /**
   * Create payment method with details
   */
  async createPaymentMethod(
    baseData: Omit<NewAccountingList, 'listType'>,
    detailsData: Omit<NewPaymentMethodsDetail, 'accountingListId'>
  ): Promise<PaymentMethodWithDetailsResult> {
    if (baseData.isDefault) {
      await this.clearDefaultFlag(baseData.organizationId, 'payment_method');
    }

    const [accountingList] = await this.db
      .insert(accountingLists)
      .values({
        ...baseData,
        listType: 'payment_method',
      })
      .returning();

    const [details] = await this.db
      .insert(paymentMethodsDetails)
      .values({
        ...detailsData,
        accountingListId: accountingList.id,
      })
      .returning();

    return { accountingList, details, depositAccount: null };
  }

  /**
   * Get payment method with details
   */
  async getPaymentMethodById(id: string, organizationId: string): Promise<PaymentMethodWithDetailsResult | null> {
    const results = await this.db
      .select({
        accountingList: accountingLists,
        details: paymentMethodsDetails,
        depositAccount: {
          id: accounts.id,
          accountNumber: accounts.accountNumber,
          accountName: accounts.accountName,
        },
      })
      .from(accountingLists)
      .innerJoin(paymentMethodsDetails, eq(paymentMethodsDetails.accountingListId, accountingLists.id))
      .leftJoin(accounts, eq(accounts.id, paymentMethodsDetails.depositAccountId))
      .where(
        and(
          eq(accountingLists.id, id),
          eq(accountingLists.organizationId, organizationId),
          eq(accountingLists.listType, 'payment_method')
        )
      );

    return results[0] || null;
  }

  /**
   * List all payment methods with details
   */
  async listPaymentMethods(params: Omit<AccountingListQueryParams, 'listType'>): Promise<{
    data: PaymentMethodWithDetailsResult[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { organizationId, activeOnly = true, search, page = 1, limit = 50 } = params;

    const conditions = [
      eq(accountingLists.organizationId, organizationId),
      eq(accountingLists.listType, 'payment_method'),
    ];

    if (activeOnly) {
      conditions.push(eq(accountingLists.isActive, true));
    }

    if (search) {
      conditions.push(
        or(
          ilike(accountingLists.code, `%${search}%`),
          ilike(accountingLists.name, `%${search}%`)
        )!
      );
    }

    const offset = (page - 1) * limit;

    const results = await this.db
      .select({
        accountingList: accountingLists,
        details: paymentMethodsDetails,
        depositAccount: {
          id: accounts.id,
          accountNumber: accounts.accountNumber,
          accountName: accounts.accountName,
        },
      })
      .from(accountingLists)
      .innerJoin(paymentMethodsDetails, eq(paymentMethodsDetails.accountingListId, accountingLists.id))
      .leftJoin(accounts, eq(accounts.id, paymentMethodsDetails.depositAccountId))
      .where(and(...conditions))
      .orderBy(asc(accountingLists.sortOrder), asc(accountingLists.name))
      .limit(limit)
      .offset(offset);

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(accountingLists)
      .where(and(...conditions));

    return {
      data: results,
      total: Number(countResult[0]?.count || 0),
      page,
      limit,
    };
  }

  /**
   * Update payment method with details
   */
  async updatePaymentMethod(
    id: string,
    organizationId: string,
    baseData: Partial<NewAccountingList>,
    detailsData: Partial<NewPaymentMethodsDetail>
  ): Promise<PaymentMethodWithDetailsResult | null> {
    if (baseData.isDefault) {
      await this.clearDefaultFlag(organizationId, 'payment_method');
    }

    if (Object.keys(baseData).length > 0) {
      await this.db
        .update(accountingLists)
        .set({ ...baseData, updatedAt: new Date() })
        .where(
          and(
            eq(accountingLists.id, id),
            eq(accountingLists.organizationId, organizationId),
            eq(accountingLists.listType, 'payment_method')
          )
        );
    }

    if (Object.keys(detailsData).length > 0) {
      await this.db
        .update(paymentMethodsDetails)
        .set({ ...detailsData, updatedAt: new Date() })
        .where(eq(paymentMethodsDetails.accountingListId, id));
    }

    return this.getPaymentMethodById(id, organizationId);
  }

  /**
   * Delete payment method (soft delete)
   */
  async deletePaymentMethod(id: string, organizationId: string): Promise<boolean> {
    await this.db
      .update(accountingLists)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(accountingLists.id, id),
          eq(accountingLists.organizationId, organizationId),
          eq(accountingLists.listType, 'payment_method')
        )
      );

    return true;
  }

  // ============================================================================
  // CHARGE TYPES METHODS
  // ============================================================================

  /**
   * Create charge type with details
   */
  async createChargeType(
    baseData: Omit<NewAccountingList, 'listType'>,
    detailsData: Omit<NewChargeTypesDetail, 'accountingListId'>
  ): Promise<ChargeTypeWithDetailsResult> {
    if (baseData.isDefault) {
      await this.clearDefaultFlag(baseData.organizationId, 'charge_type');
    }

    const [accountingList] = await this.db
      .insert(accountingLists)
      .values({
        ...baseData,
        listType: 'charge_type',
      })
      .returning();

    const [details] = await this.db
      .insert(chargeTypesDetails)
      .values({
        ...detailsData,
        accountingListId: accountingList.id,
      })
      .returning();

    return { accountingList, details, incomeAccount: null, expenseAccount: null };
  }

  /**
   * Get charge type with details
   */
  async getChargeTypeById(id: string, organizationId: string): Promise<ChargeTypeWithDetailsResult | null> {
    // Need two joins for income and expense accounts, use aliased accounts
    const incomeAccounts = this.db.$with('income_accounts').as(
      this.db.select().from(accounts)
    );
    const expenseAccounts = this.db.$with('expense_accounts').as(
      this.db.select().from(accounts)
    );

    // Simpler approach - do a basic query then fetch accounts separately
    const results = await this.db
      .select({
        accountingList: accountingLists,
        details: chargeTypesDetails,
      })
      .from(accountingLists)
      .innerJoin(chargeTypesDetails, eq(chargeTypesDetails.accountingListId, accountingLists.id))
      .where(
        and(
          eq(accountingLists.id, id),
          eq(accountingLists.organizationId, organizationId),
          eq(accountingLists.listType, 'charge_type')
        )
      );

    if (!results[0]) return null;

    const result = results[0];
    let incomeAccount = null;
    let expenseAccount = null;

    if (result.details.incomeAccountId) {
      const [acc] = await this.db
        .select({ id: accounts.id, accountNumber: accounts.accountNumber, accountName: accounts.accountName })
        .from(accounts)
        .where(eq(accounts.id, result.details.incomeAccountId));
      incomeAccount = acc || null;
    }

    if (result.details.expenseAccountId) {
      const [acc] = await this.db
        .select({ id: accounts.id, accountNumber: accounts.accountNumber, accountName: accounts.accountName })
        .from(accounts)
        .where(eq(accounts.id, result.details.expenseAccountId));
      expenseAccount = acc || null;
    }

    return { ...result, incomeAccount, expenseAccount };
  }

  /**
   * List all charge types with details
   */
  async listChargeTypes(params: Omit<AccountingListQueryParams, 'listType'>): Promise<{
    data: ChargeTypeWithDetailsResult[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { organizationId, activeOnly = true, search, page = 1, limit = 50 } = params;

    const conditions = [
      eq(accountingLists.organizationId, organizationId),
      eq(accountingLists.listType, 'charge_type'),
    ];

    if (activeOnly) {
      conditions.push(eq(accountingLists.isActive, true));
    }

    if (search) {
      conditions.push(
        or(
          ilike(accountingLists.code, `%${search}%`),
          ilike(accountingLists.name, `%${search}%`)
        )!
      );
    }

    const offset = (page - 1) * limit;

    const results = await this.db
      .select({
        accountingList: accountingLists,
        details: chargeTypesDetails,
      })
      .from(accountingLists)
      .innerJoin(chargeTypesDetails, eq(chargeTypesDetails.accountingListId, accountingLists.id))
      .where(and(...conditions))
      .orderBy(asc(accountingLists.sortOrder), asc(accountingLists.name))
      .limit(limit)
      .offset(offset);

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(accountingLists)
      .where(and(...conditions));

    // Fetch accounts for each result
    const data: ChargeTypeWithDetailsResult[] = await Promise.all(
      results.map(async (r) => {
        let incomeAccount = null;
        let expenseAccount = null;

        if (r.details.incomeAccountId) {
          const [acc] = await this.db
            .select({ id: accounts.id, accountNumber: accounts.accountNumber, accountName: accounts.accountName })
            .from(accounts)
            .where(eq(accounts.id, r.details.incomeAccountId));
          incomeAccount = acc || null;
        }

        if (r.details.expenseAccountId) {
          const [acc] = await this.db
            .select({ id: accounts.id, accountNumber: accounts.accountNumber, accountName: accounts.accountName })
            .from(accounts)
            .where(eq(accounts.id, r.details.expenseAccountId));
          expenseAccount = acc || null;
        }

        return { ...r, incomeAccount, expenseAccount };
      })
    );

    return {
      data,
      total: Number(countResult[0]?.count || 0),
      page,
      limit,
    };
  }

  /**
   * Update charge type with details
   */
  async updateChargeType(
    id: string,
    organizationId: string,
    baseData: Partial<NewAccountingList>,
    detailsData: Partial<NewChargeTypesDetail>
  ): Promise<ChargeTypeWithDetailsResult | null> {
    if (baseData.isDefault) {
      await this.clearDefaultFlag(organizationId, 'charge_type');
    }

    if (Object.keys(baseData).length > 0) {
      await this.db
        .update(accountingLists)
        .set({ ...baseData, updatedAt: new Date() })
        .where(
          and(
            eq(accountingLists.id, id),
            eq(accountingLists.organizationId, organizationId),
            eq(accountingLists.listType, 'charge_type')
          )
        );
    }

    if (Object.keys(detailsData).length > 0) {
      await this.db
        .update(chargeTypesDetails)
        .set({ ...detailsData, updatedAt: new Date() })
        .where(eq(chargeTypesDetails.accountingListId, id));
    }

    return this.getChargeTypeById(id, organizationId);
  }

  /**
   * Delete charge type (soft delete)
   */
  async deleteChargeType(id: string, organizationId: string): Promise<boolean> {
    await this.db
      .update(accountingLists)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(accountingLists.id, id),
          eq(accountingLists.organizationId, organizationId),
          eq(accountingLists.listType, 'charge_type')
        )
      );

    return true;
  }

  // ============================================================================
  // CUSTOMER ASSIGNMENT METHODS
  // ============================================================================

  /**
   * Assign accounting list to customer
   */
  async assignToCustomer(data: NewCustomerAccountingList): Promise<CustomerAccountingList> {
    const [result] = await this.db
      .insert(customerAccountingLists)
      .values(data)
      .onConflictDoUpdate({
        target: [customerAccountingLists.customerId, customerAccountingLists.accountingListId],
        set: {
          priority: data.priority,
          effectiveDate: data.effectiveDate,
          expirationDate: data.expirationDate,
        },
      })
      .returning();

    return result;
  }

  /**
   * Remove accounting list from customer
   */
  async removeFromCustomer(customerId: string, accountingListId: string): Promise<boolean> {
    await this.db
      .delete(customerAccountingLists)
      .where(
        and(
          eq(customerAccountingLists.customerId, customerId),
          eq(customerAccountingLists.accountingListId, accountingListId)
        )
      );

    return true;
  }

  /**
   * Get all accounting list assignments for a customer
   */
  async getCustomerAccountingLists(
    customerId: string,
    listType?: AccountingListType
  ): Promise<CustomerAccountingListWithDetails[]> {
    const conditions = [eq(customerAccountingLists.customerId, customerId)];

    if (listType) {
      conditions.push(eq(accountingLists.listType, listType));
    }

    const results = await this.db
      .select({
        assignment: customerAccountingLists,
        accountingList: accountingLists,
      })
      .from(customerAccountingLists)
      .innerJoin(accountingLists, eq(accountingLists.id, customerAccountingLists.accountingListId))
      .where(and(...conditions))
      .orderBy(asc(customerAccountingLists.priority));

    return results.map((r) => ({
      ...r.assignment,
      accountingList: r.accountingList,
    }));
  }

  /**
   * Get effective payment terms for a customer
   * Returns the highest priority active payment terms for the given date
   */
  async getEffectivePaymentTerms(
    customerId: string,
    organizationId: string,
    asOfDate: Date = new Date()
  ): Promise<PaymentTermsWithDetailsResult | null> {
    const dateStr = asOfDate.toISOString().split('T')[0];

    // Get customer's assigned payment terms, ordered by priority
    const assignments = await this.db
      .select({
        accountingListId: customerAccountingLists.accountingListId,
      })
      .from(customerAccountingLists)
      .innerJoin(accountingLists, eq(accountingLists.id, customerAccountingLists.accountingListId))
      .where(
        and(
          eq(customerAccountingLists.customerId, customerId),
          eq(accountingLists.listType, 'payment_terms'),
          eq(accountingLists.isActive, true),
          or(
            isNull(customerAccountingLists.effectiveDate),
            lte(customerAccountingLists.effectiveDate, dateStr)
          ),
          or(
            isNull(customerAccountingLists.expirationDate),
            gte(customerAccountingLists.expirationDate, dateStr)
          )
        )
      )
      .orderBy(asc(customerAccountingLists.priority))
      .limit(1);

    if (assignments.length > 0) {
      return this.getPaymentTermsById(assignments[0].accountingListId, organizationId);
    }

    // Fall back to organization default
    const defaultTerms = await this.getDefault(organizationId, 'payment_terms');
    if (defaultTerms) {
      return this.getPaymentTermsById(defaultTerms.id, organizationId);
    }

    return null;
  }

  /**
   * Get all customers assigned to an accounting list
   */
  async getCustomersForAccountingList(
    accountingListId: string,
    page = 1,
    limit = 50
  ): Promise<{ data: CustomerAccountingList[]; total: number }> {
    const offset = (page - 1) * limit;

    const results = await this.db
      .select()
      .from(customerAccountingLists)
      .where(eq(customerAccountingLists.accountingListId, accountingListId))
      .orderBy(asc(customerAccountingLists.priority))
      .limit(limit)
      .offset(offset);

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(customerAccountingLists)
      .where(eq(customerAccountingLists.accountingListId, accountingListId));

    return {
      data: results,
      total: Number(countResult[0]?.count || 0),
    };
  }
}
