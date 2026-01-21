import { eq, and, inArray, sql, desc } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { db } from '../db';
import {
  glAccountBalances,
  accounts,
  classes,
  departments,
  locations,
  accountingPeriods,
} from '../db/schema';
import { customMetrics, savedViews } from '../db/schema/metrics';

// ==========================================
// Types
// ==========================================

export interface DimensionFilters {
  subsidiaryIds?: string[];
  classIds?: string[];
  departmentIds?: string[];
  locationIds?: string[];
}

export interface SegmentData {
  dimensionId: string;
  dimensionName: string;
  dimensionCode?: string;
  value: number;
}

export interface PeriodFinancials {
  revenue: string;
  cogs: string;
  operatingExpenses: string;
  otherExpenses: string;
  currentAssets: string;
  currentLiabilities: string;
  inventory: string;
  accountsReceivable: string;
  accountsPayable: string;
}

// ==========================================
// Metrics Repository
// ==========================================

export class MetricsRepository extends BaseRepository {
  // ==========================================
  // Financial Aggregation Methods
  // ==========================================

  /**
   * Get aggregated financial data for a period with dimension filters
   */
  async getPeriodFinancials(
    organizationId: string,
    periodId: string,
    filters?: DimensionFilters
  ): Promise<PeriodFinancials> {
    const baseConditions = [
      eq(glAccountBalances.periodId, periodId),
      eq(accounts.organizationId, organizationId),
    ];

    // Apply dimension filters
    if (filters?.subsidiaryIds && filters.subsidiaryIds.length > 0) {
      baseConditions.push(inArray(glAccountBalances.subsidiaryId, filters.subsidiaryIds));
    }
    if (filters?.classIds && filters.classIds.length > 0) {
      baseConditions.push(inArray(glAccountBalances.classId, filters.classIds));
    }
    if (filters?.departmentIds && filters.departmentIds.length > 0) {
      baseConditions.push(inArray(glAccountBalances.departmentId, filters.departmentIds));
    }
    if (filters?.locationIds && filters.locationIds.length > 0) {
      baseConditions.push(inArray(glAccountBalances.locationId, filters.locationIds));
    }

    const result = await db
      .select({
        revenue: sql<string>`COALESCE(SUM(CASE WHEN ${accounts.accountCategory} = 'REVENUE' THEN ${glAccountBalances.periodCreditAmount} - ${glAccountBalances.periodDebitAmount} ELSE 0 END), 0)`,
        cogs: sql<string>`COALESCE(SUM(CASE WHEN ${accounts.accountCategory} = 'COGS' THEN ${glAccountBalances.periodDebitAmount} - ${glAccountBalances.periodCreditAmount} ELSE 0 END), 0)`,
        operatingExpenses: sql<string>`COALESCE(SUM(CASE WHEN ${accounts.accountCategory} = 'EXPENSE' AND ${accounts.accountSubcategory} NOT IN ('INTEREST_EXPENSE', 'TAX_EXPENSE', 'OTHER_EXPENSE') THEN ${glAccountBalances.periodDebitAmount} - ${glAccountBalances.periodCreditAmount} ELSE 0 END), 0)`,
        otherExpenses: sql<string>`COALESCE(SUM(CASE WHEN ${accounts.accountCategory} = 'EXPENSE' AND ${accounts.accountSubcategory} IN ('INTEREST_EXPENSE', 'TAX_EXPENSE', 'OTHER_EXPENSE') THEN ${glAccountBalances.periodDebitAmount} - ${glAccountBalances.periodCreditAmount} ELSE 0 END), 0)`,
        currentAssets: sql<string>`COALESCE(SUM(CASE WHEN ${accounts.accountCategory} = 'ASSET' AND ${accounts.accountSubcategory} IN ('CASH', 'ACCOUNTS_RECEIVABLE', 'INVENTORY', 'PREPAID', 'OTHER_CURRENT_ASSET') THEN ${glAccountBalances.endingBalanceDebit} - ${glAccountBalances.endingBalanceCredit} ELSE 0 END), 0)`,
        currentLiabilities: sql<string>`COALESCE(SUM(CASE WHEN ${accounts.accountCategory} = 'LIABILITY' AND ${accounts.accountSubcategory} IN ('ACCOUNTS_PAYABLE', 'ACCRUED_EXPENSE', 'DEFERRED_REVENUE', 'OTHER_CURRENT_LIABILITY', 'SHORT_TERM_DEBT') THEN ${glAccountBalances.endingBalanceCredit} - ${glAccountBalances.endingBalanceDebit} ELSE 0 END), 0)`,
        inventory: sql<string>`COALESCE(SUM(CASE WHEN ${accounts.accountSubcategory} = 'INVENTORY' THEN ${glAccountBalances.endingBalanceDebit} - ${glAccountBalances.endingBalanceCredit} ELSE 0 END), 0)`,
        accountsReceivable: sql<string>`COALESCE(SUM(CASE WHEN ${accounts.accountSubcategory} = 'ACCOUNTS_RECEIVABLE' THEN ${glAccountBalances.endingBalanceDebit} - ${glAccountBalances.endingBalanceCredit} ELSE 0 END), 0)`,
        accountsPayable: sql<string>`COALESCE(SUM(CASE WHEN ${accounts.accountSubcategory} = 'ACCOUNTS_PAYABLE' THEN ${glAccountBalances.endingBalanceCredit} - ${glAccountBalances.endingBalanceDebit} ELSE 0 END), 0)`,
      })
      .from(glAccountBalances)
      .innerJoin(accounts, eq(glAccountBalances.accountId, accounts.id))
      .where(and(...baseConditions));

    return result[0] || {
      revenue: '0',
      cogs: '0',
      operatingExpenses: '0',
      otherExpenses: '0',
      currentAssets: '0',
      currentLiabilities: '0',
      inventory: '0',
      accountsReceivable: '0',
      accountsPayable: '0',
    };
  }

  /**
   * Get segment breakdown by dimension
   */
  async getSegmentBreakdown(
    organizationId: string,
    periodId: string,
    dimensionType: 'class' | 'department' | 'location',
    metric: 'revenue' | 'expenses' | 'netIncome' | 'margin',
    filters?: DimensionFilters
  ): Promise<SegmentData[]> {
    const baseConditions = [
      eq(glAccountBalances.periodId, periodId),
      eq(accounts.organizationId, organizationId),
    ];

    // Apply other dimension filters
    if (filters?.subsidiaryIds && filters.subsidiaryIds.length > 0) {
      baseConditions.push(inArray(glAccountBalances.subsidiaryId, filters.subsidiaryIds));
    }
    // Don't filter by the dimension we're grouping by
    if (dimensionType !== 'class' && filters?.classIds && filters.classIds.length > 0) {
      baseConditions.push(inArray(glAccountBalances.classId, filters.classIds));
    }
    if (
      dimensionType !== 'department' &&
      filters?.departmentIds &&
      filters.departmentIds.length > 0
    ) {
      baseConditions.push(inArray(glAccountBalances.departmentId, filters.departmentIds));
    }
    if (dimensionType !== 'location' && filters?.locationIds && filters.locationIds.length > 0) {
      baseConditions.push(inArray(glAccountBalances.locationId, filters.locationIds));
    }

    // Build metric calculation
    let metricSql: any;
    switch (metric) {
      case 'revenue':
        metricSql = sql<string>`COALESCE(SUM(CASE WHEN ${accounts.accountCategory} = 'REVENUE' THEN ${glAccountBalances.periodCreditAmount} - ${glAccountBalances.periodDebitAmount} ELSE 0 END), 0)`;
        break;
      case 'expenses':
        metricSql = sql<string>`COALESCE(SUM(CASE WHEN ${accounts.accountCategory} IN ('EXPENSE', 'COGS') THEN ${glAccountBalances.periodDebitAmount} - ${glAccountBalances.periodCreditAmount} ELSE 0 END), 0)`;
        break;
      case 'netIncome':
        metricSql = sql<string>`COALESCE(
          SUM(CASE WHEN ${accounts.accountCategory} = 'REVENUE' THEN ${glAccountBalances.periodCreditAmount} - ${glAccountBalances.periodDebitAmount} ELSE 0 END) -
          SUM(CASE WHEN ${accounts.accountCategory} IN ('EXPENSE', 'COGS') THEN ${glAccountBalances.periodDebitAmount} - ${glAccountBalances.periodCreditAmount} ELSE 0 END)
        , 0)`;
        break;
      case 'margin':
        metricSql = sql<string>`CASE
          WHEN SUM(CASE WHEN ${accounts.accountCategory} = 'REVENUE' THEN ${glAccountBalances.periodCreditAmount} - ${glAccountBalances.periodDebitAmount} ELSE 0 END) > 0
          THEN (
            SUM(CASE WHEN ${accounts.accountCategory} = 'REVENUE' THEN ${glAccountBalances.periodCreditAmount} - ${glAccountBalances.periodDebitAmount} ELSE 0 END) -
            SUM(CASE WHEN ${accounts.accountCategory} IN ('EXPENSE', 'COGS') THEN ${glAccountBalances.periodDebitAmount} - ${glAccountBalances.periodCreditAmount} ELSE 0 END)
          ) / SUM(CASE WHEN ${accounts.accountCategory} = 'REVENUE' THEN ${glAccountBalances.periodCreditAmount} - ${glAccountBalances.periodDebitAmount} ELSE 0 END) * 100
          ELSE 0
        END`;
        break;
    }

    // Build query based on dimension type
    let query;
    switch (dimensionType) {
      case 'class':
        query = db
          .select({
            dimensionId: classes.id,
            dimensionName: classes.name,
            dimensionCode: classes.code,
            value: metricSql,
          })
          .from(glAccountBalances)
          .innerJoin(accounts, eq(glAccountBalances.accountId, accounts.id))
          .innerJoin(classes, eq(glAccountBalances.classId, classes.id))
          .where(and(...baseConditions, sql`${glAccountBalances.classId} IS NOT NULL`))
          .groupBy(classes.id, classes.name, classes.code)
          .orderBy(desc(metricSql));
        break;

      case 'department':
        query = db
          .select({
            dimensionId: departments.id,
            dimensionName: departments.name,
            dimensionCode: departments.code,
            value: metricSql,
          })
          .from(glAccountBalances)
          .innerJoin(accounts, eq(glAccountBalances.accountId, accounts.id))
          .innerJoin(departments, eq(glAccountBalances.departmentId, departments.id))
          .where(and(...baseConditions, sql`${glAccountBalances.departmentId} IS NOT NULL`))
          .groupBy(departments.id, departments.name, departments.code)
          .orderBy(desc(metricSql));
        break;

      case 'location':
        query = db
          .select({
            dimensionId: locations.id,
            dimensionName: locations.name,
            dimensionCode: locations.code,
            value: metricSql,
          })
          .from(glAccountBalances)
          .innerJoin(accounts, eq(glAccountBalances.accountId, accounts.id))
          .innerJoin(locations, eq(glAccountBalances.locationId, locations.id))
          .where(and(...baseConditions, sql`${glAccountBalances.locationId} IS NOT NULL`))
          .groupBy(locations.id, locations.name, locations.code)
          .orderBy(desc(metricSql));
        break;
    }

    const results = await query;
    return results.map((r) => ({
      dimensionId: r.dimensionId,
      dimensionName: r.dimensionName,
      dimensionCode: r.dimensionCode || undefined,
      value: parseFloat(r.value || '0'),
    }));
  }

  // ==========================================
  // Custom Metrics Methods
  // ==========================================

  /**
   * Find all custom metrics for an organization
   */
  async findCustomMetrics(organizationId: string) {
    return db
      .select()
      .from(customMetrics)
      .where(eq(customMetrics.organizationId, organizationId))
      .orderBy(customMetrics.name);
  }

  /**
   * Find a custom metric by ID
   */
  async findCustomMetricById(id: string, organizationId: string) {
    const results = await db
      .select()
      .from(customMetrics)
      .where(and(eq(customMetrics.id, id), eq(customMetrics.organizationId, organizationId)));
    return results[0] || null;
  }

  /**
   * Create a custom metric
   */
  async createCustomMetric(data: {
    organizationId: string;
    name: string;
    description?: string;
    category: string;
    formula: string;
    unit: string;
    aggregation: string;
    isPercentage?: boolean;
    precision?: number;
    thresholds?: string | null;
  }) {
    const results = await db
      .insert(customMetrics)
      .values({
        ...data,
        isPercentage: data.isPercentage || false,
        precision: data.precision || 2,
      })
      .returning();
    return results[0];
  }

  /**
   * Update a custom metric
   */
  async updateCustomMetric(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      category: string;
      formula: string;
      unit: string;
      aggregation: string;
      isPercentage: boolean;
      precision: number;
      thresholds: string;
    }>
  ) {
    const updateData: any = { ...data, updatedAt: new Date() };
    // Remove undefined values
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key]
    );

    await db.update(customMetrics).set(updateData).where(eq(customMetrics.id, id));
  }

  /**
   * Delete a custom metric
   */
  async deleteCustomMetric(id: string) {
    await db.delete(customMetrics).where(eq(customMetrics.id, id));
  }

  // ==========================================
  // Saved Views Methods
  // ==========================================

  /**
   * Find saved views for an organization
   */
  async findSavedViews(organizationId: string, viewType?: string) {
    const conditions = [eq(savedViews.organizationId, organizationId)];
    if (viewType) {
      conditions.push(eq(savedViews.viewType, viewType));
    }

    return db
      .select()
      .from(savedViews)
      .where(and(...conditions))
      .orderBy(desc(savedViews.isDefault), savedViews.name);
  }

  /**
   * Find a saved view by ID
   */
  async findSavedViewById(id: string, organizationId: string) {
    const results = await db
      .select()
      .from(savedViews)
      .where(and(eq(savedViews.id, id), eq(savedViews.organizationId, organizationId)));
    return results[0] || null;
  }

  /**
   * Create a saved view
   */
  async createSavedView(data: {
    organizationId: string;
    name: string;
    description?: string;
    viewType: string;
    configuration: string;
    isDefault?: boolean;
    isShared?: boolean;
    createdBy: string;
  }) {
    const results = await db
      .insert(savedViews)
      .values({
        ...data,
        isDefault: data.isDefault || false,
        isShared: data.isShared || false,
      })
      .returning();
    return results[0];
  }

  /**
   * Update a saved view
   */
  async updateSavedView(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      configuration: string;
      isDefault: boolean;
      isShared: boolean;
    }>
  ) {
    const updateData: any = { ...data, updatedAt: new Date() };
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key]
    );

    await db.update(savedViews).set(updateData).where(eq(savedViews.id, id));
  }

  /**
   * Delete a saved view
   */
  async deleteSavedView(id: string) {
    await db.delete(savedViews).where(eq(savedViews.id, id));
  }

  /**
   * Clear default views for a type
   */
  async clearDefaultViews(organizationId: string, viewType: string) {
    await db
      .update(savedViews)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(savedViews.organizationId, organizationId),
          eq(savedViews.viewType, viewType),
          eq(savedViews.isDefault, true)
        )
      );
  }
}
