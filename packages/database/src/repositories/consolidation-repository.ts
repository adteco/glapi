import { and, asc, desc, eq, sql, isNull, gte, lte, or } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  consolidationGroups,
  consolidationGroupMembers,
  eliminationRules,
  fxTranslationRules,
  consolidationExchangeRates,
  consolidationRuns,
  consolidationAdjustments,
  intercompanyAccountMappings,
} from '../db/schema/consolidation';
import { subsidiaries } from '../db/schema/subsidiaries';
import { currencies } from '../db/schema/currencies';
import { accounts } from '../db/schema/accounts';
import { accountingPeriods } from '../db/schema/accounting-periods';

// ==========================================
// Type Definitions
// ==========================================

export interface ConsolidationGroupFilters {
  isActive?: boolean;
  parentSubsidiaryId?: string;
}

export interface ConsolidationGroupMemberFilters {
  isActive?: boolean;
  consolidationMethod?: 'FULL' | 'PROPORTIONAL' | 'EQUITY';
}

export interface EliminationRuleFilters {
  isActive?: boolean;
  eliminationType?: string;
  isAutomatic?: boolean;
}

export interface ConsolidationRunFilters {
  status?: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  runType?: 'PRELIMINARY' | 'FINAL';
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

// ==========================================
// Consolidation Repository
// ==========================================

export class ConsolidationRepository extends BaseRepository {
  // ==========================================
  // Consolidation Groups
  // ==========================================

  async findGroupById(id: string, organizationId: string) {
    const [result] = await this.db
      .select({
        group: consolidationGroups,
        parentSubsidiary: subsidiaries,
        consolidationCurrency: currencies,
      })
      .from(consolidationGroups)
      .leftJoin(subsidiaries, eq(consolidationGroups.parentSubsidiaryId, subsidiaries.id))
      .leftJoin(currencies, eq(consolidationGroups.consolidationCurrencyId, currencies.id))
      .where(
        and(
          eq(consolidationGroups.id, id),
          eq(consolidationGroups.organizationId, organizationId)
        )
      )
      .limit(1);

    return result || null;
  }

  async findGroupByCode(code: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(consolidationGroups)
      .where(
        and(
          eq(consolidationGroups.code, code),
          eq(consolidationGroups.organizationId, organizationId)
        )
      )
      .limit(1);

    return result || null;
  }

  async findAllGroups(
    organizationId: string,
    params: PaginationParams = {},
    filters: ConsolidationGroupFilters = {}
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const offset = (page - 1) * limit;

    const whereConditions = [eq(consolidationGroups.organizationId, organizationId)];

    if (filters.isActive !== undefined) {
      whereConditions.push(eq(consolidationGroups.isActive, filters.isActive));
    }

    if (filters.parentSubsidiaryId) {
      whereConditions.push(eq(consolidationGroups.parentSubsidiaryId, filters.parentSubsidiaryId));
    }

    const whereClause = and(...whereConditions);

    const [countResult] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(consolidationGroups)
      .where(whereClause);

    const total = countResult?.count || 0;

    const orderFunc = params.orderDirection === 'desc' ? desc : asc;
    const orderColumn = params.orderBy === 'code' ? consolidationGroups.code : consolidationGroups.name;

    const results = await this.db
      .select({
        group: consolidationGroups,
        parentSubsidiary: subsidiaries,
        consolidationCurrency: currencies,
      })
      .from(consolidationGroups)
      .leftJoin(subsidiaries, eq(consolidationGroups.parentSubsidiaryId, subsidiaries.id))
      .leftJoin(currencies, eq(consolidationGroups.consolidationCurrencyId, currencies.id))
      .where(whereClause)
      .orderBy(orderFunc(orderColumn))
      .limit(limit)
      .offset(offset);

    return {
      data: results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createGroup(data: typeof consolidationGroups.$inferInsert) {
    const [result] = await this.db
      .insert(consolidationGroups)
      .values(data)
      .returning();

    return result;
  }

  async updateGroup(id: string, data: Partial<typeof consolidationGroups.$inferInsert>, organizationId: string) {
    const [result] = await this.db
      .update(consolidationGroups)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(consolidationGroups.id, id),
          eq(consolidationGroups.organizationId, organizationId)
        )
      )
      .returning();

    return result || null;
  }

  async deleteGroup(id: string, organizationId: string) {
    await this.db
      .delete(consolidationGroups)
      .where(
        and(
          eq(consolidationGroups.id, id),
          eq(consolidationGroups.organizationId, organizationId)
        )
      );
  }

  // ==========================================
  // Consolidation Group Members
  // ==========================================

  async findMembersByGroupId(groupId: string, filters: ConsolidationGroupMemberFilters = {}) {
    const whereConditions = [eq(consolidationGroupMembers.groupId, groupId)];

    if (filters.isActive !== undefined) {
      whereConditions.push(eq(consolidationGroupMembers.isActive, filters.isActive));
    }

    if (filters.consolidationMethod) {
      whereConditions.push(eq(consolidationGroupMembers.consolidationMethod, filters.consolidationMethod));
    }

    const results = await this.db
      .select({
        member: consolidationGroupMembers,
        subsidiary: subsidiaries,
        minorityInterestAccount: accounts,
      })
      .from(consolidationGroupMembers)
      .leftJoin(subsidiaries, eq(consolidationGroupMembers.subsidiaryId, subsidiaries.id))
      .leftJoin(accounts, eq(consolidationGroupMembers.minorityInterestAccountId, accounts.id))
      .where(and(...whereConditions))
      .orderBy(asc(consolidationGroupMembers.sequenceNumber));

    return results;
  }

  async addMemberToGroup(data: typeof consolidationGroupMembers.$inferInsert) {
    const [result] = await this.db
      .insert(consolidationGroupMembers)
      .values(data)
      .returning();

    return result;
  }

  async updateMember(id: string, data: Partial<typeof consolidationGroupMembers.$inferInsert>) {
    const [result] = await this.db
      .update(consolidationGroupMembers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(consolidationGroupMembers.id, id))
      .returning();

    return result || null;
  }

  async removeMember(id: string) {
    await this.db
      .delete(consolidationGroupMembers)
      .where(eq(consolidationGroupMembers.id, id));
  }

  // ==========================================
  // Elimination Rules
  // ==========================================

  async findEliminationRulesByGroupId(groupId: string, filters: EliminationRuleFilters = {}) {
    const whereConditions = [eq(eliminationRules.groupId, groupId)];

    if (filters.isActive !== undefined) {
      whereConditions.push(eq(eliminationRules.isActive, filters.isActive));
    }

    if (filters.eliminationType) {
      whereConditions.push(eq(eliminationRules.eliminationType, filters.eliminationType as any));
    }

    if (filters.isAutomatic !== undefined) {
      whereConditions.push(eq(eliminationRules.isAutomatic, filters.isAutomatic));
    }

    const results = await this.db
      .select()
      .from(eliminationRules)
      .where(and(...whereConditions))
      .orderBy(asc(eliminationRules.sequenceNumber));

    return results;
  }

  async findEliminationRuleById(id: string) {
    const [result] = await this.db
      .select()
      .from(eliminationRules)
      .where(eq(eliminationRules.id, id))
      .limit(1);

    return result || null;
  }

  async createEliminationRule(data: typeof eliminationRules.$inferInsert) {
    const [result] = await this.db
      .insert(eliminationRules)
      .values(data)
      .returning();

    return result;
  }

  async updateEliminationRule(id: string, data: Partial<typeof eliminationRules.$inferInsert>) {
    const [result] = await this.db
      .update(eliminationRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(eliminationRules.id, id))
      .returning();

    return result || null;
  }

  async deleteEliminationRule(id: string) {
    await this.db
      .delete(eliminationRules)
      .where(eq(eliminationRules.id, id));
  }

  // ==========================================
  // FX Translation Rules
  // ==========================================

  async findFxRulesByGroupId(groupId: string) {
    const results = await this.db
      .select()
      .from(fxTranslationRules)
      .where(
        and(
          eq(fxTranslationRules.groupId, groupId),
          eq(fxTranslationRules.isActive, true)
        )
      )
      .orderBy(asc(fxTranslationRules.sequenceNumber));

    return results;
  }

  async createFxRule(data: typeof fxTranslationRules.$inferInsert) {
    const [result] = await this.db
      .insert(fxTranslationRules)
      .values(data)
      .returning();

    return result;
  }

  async updateFxRule(id: string, data: Partial<typeof fxTranslationRules.$inferInsert>) {
    const [result] = await this.db
      .update(fxTranslationRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(fxTranslationRules.id, id))
      .returning();

    return result || null;
  }

  async deleteFxRule(id: string) {
    await this.db
      .delete(fxTranslationRules)
      .where(eq(fxTranslationRules.id, id));
  }

  // ==========================================
  // Exchange Rates
  // ==========================================

  async findExchangeRate(
    organizationId: string,
    fromCurrencyId: string,
    toCurrencyId: string,
    periodId: string,
    rateType: string = 'CURRENT'
  ) {
    const [result] = await this.db
      .select()
      .from(consolidationExchangeRates)
      .where(
        and(
          eq(consolidationExchangeRates.organizationId, organizationId),
          eq(consolidationExchangeRates.fromCurrencyId, fromCurrencyId),
          eq(consolidationExchangeRates.toCurrencyId, toCurrencyId),
          eq(consolidationExchangeRates.periodId, periodId),
          eq(consolidationExchangeRates.rateType, rateType)
        )
      )
      .limit(1);

    return result || null;
  }

  async findExchangeRatesByPeriod(organizationId: string, periodId: string) {
    const results = await this.db
      .select({
        rate: consolidationExchangeRates,
        fromCurrency: currencies,
        toCurrency: currencies,
      })
      .from(consolidationExchangeRates)
      .leftJoin(currencies, eq(consolidationExchangeRates.fromCurrencyId, currencies.id))
      .where(
        and(
          eq(consolidationExchangeRates.organizationId, organizationId),
          eq(consolidationExchangeRates.periodId, periodId)
        )
      );

    return results;
  }

  async upsertExchangeRate(data: typeof consolidationExchangeRates.$inferInsert) {
    const [result] = await this.db
      .insert(consolidationExchangeRates)
      .values(data)
      .onConflictDoUpdate({
        target: [
          consolidationExchangeRates.fromCurrencyId,
          consolidationExchangeRates.toCurrencyId,
          consolidationExchangeRates.periodId,
          consolidationExchangeRates.rateType,
        ],
        set: {
          rate: data.rate,
          rateDate: data.rateDate,
          source: data.source,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result;
  }

  async deleteExchangeRate(id: string) {
    await this.db
      .delete(consolidationExchangeRates)
      .where(eq(consolidationExchangeRates.id, id));
  }

  // ==========================================
  // Consolidation Runs
  // ==========================================

  async findRunById(id: string) {
    const [result] = await this.db
      .select({
        run: consolidationRuns,
        group: consolidationGroups,
        period: accountingPeriods,
      })
      .from(consolidationRuns)
      .leftJoin(consolidationGroups, eq(consolidationRuns.groupId, consolidationGroups.id))
      .leftJoin(accountingPeriods, eq(consolidationRuns.periodId, accountingPeriods.id))
      .where(eq(consolidationRuns.id, id))
      .limit(1);

    return result || null;
  }

  async findRunsByGroupAndPeriod(
    groupId: string,
    periodId: string,
    filters: ConsolidationRunFilters = {}
  ) {
    const whereConditions = [
      eq(consolidationRuns.groupId, groupId),
      eq(consolidationRuns.periodId, periodId),
    ];

    if (filters.status) {
      whereConditions.push(eq(consolidationRuns.status, filters.status));
    }

    if (filters.runType) {
      whereConditions.push(eq(consolidationRuns.runType, filters.runType));
    }

    const results = await this.db
      .select()
      .from(consolidationRuns)
      .where(and(...whereConditions))
      .orderBy(desc(consolidationRuns.runNumber));

    return results;
  }

  async getNextRunNumber(groupId: string, periodId: string): Promise<number> {
    const [result] = await this.db
      .select({ maxRunNumber: sql<number>`COALESCE(MAX(run_number), 0)::int` })
      .from(consolidationRuns)
      .where(
        and(
          eq(consolidationRuns.groupId, groupId),
          eq(consolidationRuns.periodId, periodId)
        )
      );

    return (result?.maxRunNumber || 0) + 1;
  }

  async createRun(data: typeof consolidationRuns.$inferInsert) {
    const [result] = await this.db
      .insert(consolidationRuns)
      .values(data)
      .returning();

    return result;
  }

  async updateRun(id: string, data: Partial<typeof consolidationRuns.$inferInsert>) {
    const [result] = await this.db
      .update(consolidationRuns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(consolidationRuns.id, id))
      .returning();

    return result || null;
  }

  // ==========================================
  // Consolidation Adjustments
  // ==========================================

  async findAdjustmentsByRunId(runId: string, adjustmentType?: string) {
    const whereConditions = [eq(consolidationAdjustments.runId, runId)];

    if (adjustmentType) {
      whereConditions.push(eq(consolidationAdjustments.adjustmentType, adjustmentType));
    }

    const results = await this.db
      .select({
        adjustment: consolidationAdjustments,
        account: accounts,
        sourceSubsidiary: subsidiaries,
      })
      .from(consolidationAdjustments)
      .leftJoin(accounts, eq(consolidationAdjustments.accountId, accounts.id))
      .leftJoin(subsidiaries, eq(consolidationAdjustments.sourceSubsidiaryId, subsidiaries.id))
      .where(and(...whereConditions))
      .orderBy(asc(consolidationAdjustments.lineNumber));

    return results;
  }

  async createAdjustments(data: (typeof consolidationAdjustments.$inferInsert)[]) {
    if (data.length === 0) return [];

    const results = await this.db
      .insert(consolidationAdjustments)
      .values(data)
      .returning();

    return results;
  }

  async deleteAdjustmentsByRunId(runId: string) {
    await this.db
      .delete(consolidationAdjustments)
      .where(eq(consolidationAdjustments.runId, runId));
  }

  // ==========================================
  // Intercompany Account Mappings
  // ==========================================

  async findIntercompanyMappings(organizationId: string) {
    const results = await this.db
      .select()
      .from(intercompanyAccountMappings)
      .where(
        and(
          eq(intercompanyAccountMappings.organizationId, organizationId),
          eq(intercompanyAccountMappings.isActive, true)
        )
      );

    return results;
  }

  async findIntercompanyMappingById(id: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(intercompanyAccountMappings)
      .where(
        and(
          eq(intercompanyAccountMappings.id, id),
          eq(intercompanyAccountMappings.organizationId, organizationId)
        )
      )
      .limit(1);

    return result || null;
  }

  async createIntercompanyMapping(data: typeof intercompanyAccountMappings.$inferInsert) {
    const [result] = await this.db
      .insert(intercompanyAccountMappings)
      .values(data)
      .returning();

    return result;
  }

  async updateIntercompanyMapping(
    id: string,
    data: Partial<typeof intercompanyAccountMappings.$inferInsert>,
    organizationId: string
  ) {
    const [result] = await this.db
      .update(intercompanyAccountMappings)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(intercompanyAccountMappings.id, id),
          eq(intercompanyAccountMappings.organizationId, organizationId)
        )
      )
      .returning();

    return result || null;
  }

  async deleteIntercompanyMapping(id: string, organizationId: string) {
    await this.db
      .delete(intercompanyAccountMappings)
      .where(
        and(
          eq(intercompanyAccountMappings.id, id),
          eq(intercompanyAccountMappings.organizationId, organizationId)
        )
      );
  }

  // ==========================================
  // Consolidation Summary Queries
  // ==========================================

  async getGroupSummary(groupId: string, periodId: string) {
    // Get member count
    const [memberCount] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(consolidationGroupMembers)
      .where(
        and(
          eq(consolidationGroupMembers.groupId, groupId),
          eq(consolidationGroupMembers.isActive, true)
        )
      );

    // Get elimination rule count
    const [ruleCount] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(eliminationRules)
      .where(
        and(
          eq(eliminationRules.groupId, groupId),
          eq(eliminationRules.isActive, true)
        )
      );

    // Get latest run for the period
    const [latestRun] = await this.db
      .select()
      .from(consolidationRuns)
      .where(
        and(
          eq(consolidationRuns.groupId, groupId),
          eq(consolidationRuns.periodId, periodId)
        )
      )
      .orderBy(desc(consolidationRuns.runNumber))
      .limit(1);

    return {
      memberCount: memberCount?.count || 0,
      eliminationRuleCount: ruleCount?.count || 0,
      latestRun: latestRun || null,
    };
  }
}
