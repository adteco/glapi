import { BaseService } from './base-service';
import { ServiceError } from '../types';
import { ConsolidationRepository } from '@glapi/database';

// ==========================================
// Type Definitions
// ==========================================

export interface ConsolidationGroup {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description?: string;
  parentSubsidiaryId: string;
  consolidationCurrencyId: string;
  translationMethod: 'CURRENT_RATE' | 'TEMPORAL' | 'MONETARY_NONMONETARY';
  isActive: boolean;
  effectiveDate: Date;
  endDate?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  parentSubsidiary?: {
    id: string;
    name: string;
    code?: string;
  };
  consolidationCurrency?: {
    id: string;
    code: string;
    name: string;
    symbol: string;
  };
}

export interface ConsolidationGroupMember {
  id: string;
  groupId: string;
  subsidiaryId: string;
  ownershipPercent: string;
  votingPercent?: string;
  consolidationMethod: 'FULL' | 'PROPORTIONAL' | 'EQUITY';
  minorityInterestAccountId?: string;
  effectiveDate: Date;
  endDate?: Date;
  sequenceNumber: number;
  isActive: boolean;
  // Joined fields
  subsidiary?: {
    id: string;
    name: string;
    code?: string;
  };
  minorityInterestAccount?: {
    id: string;
    accountNumber: string;
    accountName: string;
  };
}

export interface EliminationRule {
  id: string;
  groupId: string;
  name: string;
  description?: string;
  eliminationType: string;
  sequenceNumber: number;
  sourceSubsidiaryId?: string;
  sourceAccountId?: string;
  sourceAccountPattern?: string;
  targetSubsidiaryId?: string;
  targetAccountId?: string;
  targetAccountPattern?: string;
  eliminationDebitAccountId?: string;
  eliminationCreditAccountId?: string;
  isAutomatic: boolean;
  isActive: boolean;
  effectiveDate: Date;
  endDate?: Date;
}

export interface FxTranslationRule {
  id: string;
  groupId: string;
  name: string;
  accountType: string;
  accountSubType?: string;
  accountPattern?: string;
  rateType: string;
  ctaAccountId?: string;
  sequenceNumber: number;
  isActive: boolean;
}

export interface ConsolidationExchangeRate {
  id: string;
  organizationId: string;
  fromCurrencyId: string;
  toCurrencyId: string;
  periodId: string;
  rateType: string;
  rate: string;
  rateDate: Date;
  source?: string;
}

export interface ConsolidationRun {
  id: string;
  groupId: string;
  periodId: string;
  runNumber: number;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  runType: 'PRELIMINARY' | 'FINAL';
  description?: string;
  subsidiariesProcessed: number;
  eliminationsGenerated: number;
  translationAdjustments: number;
  totalDebitAmount: string;
  totalCreditAmount: string;
  startedAt?: Date;
  completedAt?: Date;
  reversedAt?: Date;
  createdBy?: string;
  createdAt: Date;
}

export interface IntercompanyMapping {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  sourceAccountId: string;
  targetAccountId: string;
  eliminationDebitAccountId?: string;
  eliminationCreditAccountId?: string;
  isActive: boolean;
}

export interface CreateConsolidationGroupInput {
  organizationId: string;
  name: string;
  code: string;
  description?: string;
  parentSubsidiaryId: string;
  consolidationCurrencyId: string;
  translationMethod?: 'CURRENT_RATE' | 'TEMPORAL' | 'MONETARY_NONMONETARY';
  effectiveDate: string | Date;
  endDate?: string | Date;
}

export interface UpdateConsolidationGroupInput {
  name?: string;
  code?: string;
  description?: string;
  translationMethod?: 'CURRENT_RATE' | 'TEMPORAL' | 'MONETARY_NONMONETARY';
  isActive?: boolean;
  endDate?: string | Date | null;
}

export interface AddGroupMemberInput {
  groupId: string;
  subsidiaryId: string;
  ownershipPercent: number;
  votingPercent?: number;
  consolidationMethod?: 'FULL' | 'PROPORTIONAL' | 'EQUITY';
  minorityInterestAccountId?: string;
  effectiveDate: string | Date;
  endDate?: string | Date;
  sequenceNumber?: number;
}

export interface CreateEliminationRuleInput {
  groupId: string;
  name: string;
  description?: string;
  eliminationType: string;
  sequenceNumber?: number;
  sourceSubsidiaryId?: string;
  sourceAccountId?: string;
  sourceAccountPattern?: string;
  targetSubsidiaryId?: string;
  targetAccountId?: string;
  targetAccountPattern?: string;
  eliminationDebitAccountId?: string;
  eliminationCreditAccountId?: string;
  isAutomatic?: boolean;
  effectiveDate: string | Date;
  endDate?: string | Date;
}

export interface CreateExchangeRateInput {
  organizationId: string;
  fromCurrencyId: string;
  toCurrencyId: string;
  periodId: string;
  rateType: string;
  rate: number;
  rateDate: string | Date;
  source?: string;
}

export interface CreateIntercompanyMappingInput {
  organizationId: string;
  name: string;
  description?: string;
  sourceAccountId: string;
  targetAccountId: string;
  eliminationDebitAccountId?: string;
  eliminationCreditAccountId?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==========================================
// Consolidation Service
// ==========================================

export class ConsolidationService extends BaseService {
  private consolidationRepository: ConsolidationRepository;

  constructor(context: { organizationId?: string } = {}) {
    super(context);
    this.consolidationRepository = new ConsolidationRepository();
  }

  // ==========================================
  // Consolidation Groups
  // ==========================================

  private transformGroup(result: any): ConsolidationGroup {
    const group = result.group || result;
    return {
      id: group.id,
      organizationId: group.organizationId,
      name: group.name,
      code: group.code,
      description: group.description || undefined,
      parentSubsidiaryId: group.parentSubsidiaryId,
      consolidationCurrencyId: group.consolidationCurrencyId,
      translationMethod: group.translationMethod,
      isActive: group.isActive,
      effectiveDate: new Date(group.effectiveDate),
      endDate: group.endDate ? new Date(group.endDate) : undefined,
      createdBy: group.createdBy || undefined,
      createdAt: new Date(group.createdAt),
      updatedAt: new Date(group.updatedAt),
      parentSubsidiary: result.parentSubsidiary
        ? {
            id: result.parentSubsidiary.id,
            name: result.parentSubsidiary.name,
            code: result.parentSubsidiary.code || undefined,
          }
        : undefined,
      consolidationCurrency: result.consolidationCurrency
        ? {
            id: result.consolidationCurrency.id,
            code: result.consolidationCurrency.code,
            name: result.consolidationCurrency.name,
            symbol: result.consolidationCurrency.symbol,
          }
        : undefined,
    };
  }

  async listConsolidationGroups(
    params: PaginationParams = {},
    filters: { isActive?: boolean; parentSubsidiaryId?: string } = {}
  ): Promise<PaginatedResult<ConsolidationGroup>> {
    const organizationId = this.requireOrganizationContext();

    const result = await this.consolidationRepository.findAllGroups(
      organizationId,
      params,
      filters
    );

    return {
      ...result,
      data: result.data.map((r) => this.transformGroup(r)),
    };
  }

  async getConsolidationGroupById(id: string): Promise<ConsolidationGroup | null> {
    const organizationId = this.requireOrganizationContext();
    const result = await this.consolidationRepository.findGroupById(id, organizationId);
    return result ? this.transformGroup(result) : null;
  }

  async createConsolidationGroup(data: CreateConsolidationGroupInput): Promise<ConsolidationGroup> {
    const organizationId = this.requireOrganizationContext();

    if (data.organizationId !== organizationId) {
      throw new ServiceError(
        'Organization ID must match the current context',
        'INVALID_ORGANIZATION_ID',
        400
      );
    }

    // Check for duplicate code
    const existing = await this.consolidationRepository.findGroupByCode(data.code, organizationId);
    if (existing) {
      throw new ServiceError(
        `Consolidation group with code "${data.code}" already exists`,
        'DUPLICATE_GROUP_CODE',
        400
      );
    }

    const group = await this.consolidationRepository.createGroup({
      organizationId,
      name: data.name,
      code: data.code,
      description: data.description,
      parentSubsidiaryId: data.parentSubsidiaryId,
      consolidationCurrencyId: data.consolidationCurrencyId,
      translationMethod: data.translationMethod || 'CURRENT_RATE',
      effectiveDate: new Date(data.effectiveDate).toISOString().split('T')[0],
      endDate: data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : undefined,
    });

    return this.transformGroup({ group });
  }

  async updateConsolidationGroup(
    id: string,
    data: UpdateConsolidationGroupInput
  ): Promise<ConsolidationGroup> {
    const organizationId = this.requireOrganizationContext();

    const existing = await this.consolidationRepository.findGroupById(id, organizationId);
    if (!existing) {
      throw new ServiceError(
        `Consolidation group with ID "${id}" not found`,
        'GROUP_NOT_FOUND',
        404
      );
    }

    // Check for duplicate code if being updated
    if (data.code && data.code !== existing.group.code) {
      const duplicateCode = await this.consolidationRepository.findGroupByCode(
        data.code,
        organizationId
      );
      if (duplicateCode) {
        throw new ServiceError(
          `Consolidation group with code "${data.code}" already exists`,
          'DUPLICATE_GROUP_CODE',
          400
        );
      }
    }

    const updated = await this.consolidationRepository.updateGroup(
      id,
      {
        ...data,
        endDate: data.endDate === null ? undefined : data.endDate
          ? new Date(data.endDate).toISOString().split('T')[0]
          : undefined,
      },
      organizationId
    );

    if (!updated) {
      throw new ServiceError('Failed to update consolidation group', 'UPDATE_FAILED', 500);
    }

    // Fetch the full result with joins
    const result = await this.consolidationRepository.findGroupById(id, organizationId);
    return this.transformGroup(result);
  }

  async deleteConsolidationGroup(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    const existing = await this.consolidationRepository.findGroupById(id, organizationId);
    if (!existing) {
      throw new ServiceError(
        `Consolidation group with ID "${id}" not found`,
        'GROUP_NOT_FOUND',
        404
      );
    }

    await this.consolidationRepository.deleteGroup(id, organizationId);
  }

  // ==========================================
  // Group Members
  // ==========================================

  private transformMember(result: any): ConsolidationGroupMember {
    const member = result.member || result;
    return {
      id: member.id,
      groupId: member.groupId,
      subsidiaryId: member.subsidiaryId,
      ownershipPercent: member.ownershipPercent,
      votingPercent: member.votingPercent || undefined,
      consolidationMethod: member.consolidationMethod,
      minorityInterestAccountId: member.minorityInterestAccountId || undefined,
      effectiveDate: new Date(member.effectiveDate),
      endDate: member.endDate ? new Date(member.endDate) : undefined,
      sequenceNumber: member.sequenceNumber,
      isActive: member.isActive,
      subsidiary: result.subsidiary
        ? {
            id: result.subsidiary.id,
            name: result.subsidiary.name,
            code: result.subsidiary.code || undefined,
          }
        : undefined,
      minorityInterestAccount: result.minorityInterestAccount
        ? {
            id: result.minorityInterestAccount.id,
            accountNumber: result.minorityInterestAccount.accountNumber,
            accountName: result.minorityInterestAccount.accountName,
          }
        : undefined,
    };
  }

  async getGroupMembers(
    groupId: string,
    filters: { isActive?: boolean; consolidationMethod?: 'FULL' | 'PROPORTIONAL' | 'EQUITY' } = {}
  ): Promise<ConsolidationGroupMember[]> {
    const results = await this.consolidationRepository.findMembersByGroupId(groupId, filters);
    return results.map((r) => this.transformMember(r));
  }

  async addGroupMember(data: AddGroupMemberInput): Promise<ConsolidationGroupMember> {
    const member = await this.consolidationRepository.addMemberToGroup({
      groupId: data.groupId,
      subsidiaryId: data.subsidiaryId,
      ownershipPercent: data.ownershipPercent.toString(),
      votingPercent: data.votingPercent?.toString(),
      consolidationMethod: data.consolidationMethod || 'FULL',
      minorityInterestAccountId: data.minorityInterestAccountId,
      effectiveDate: new Date(data.effectiveDate).toISOString().split('T')[0],
      endDate: data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : undefined,
      sequenceNumber: data.sequenceNumber || 1,
    });

    return this.transformMember({ member });
  }

  async updateGroupMember(
    id: string,
    data: Partial<AddGroupMemberInput>
  ): Promise<ConsolidationGroupMember> {
    const updated = await this.consolidationRepository.updateMember(id, {
      ...data,
      ownershipPercent: data.ownershipPercent?.toString(),
      votingPercent: data.votingPercent?.toString(),
      effectiveDate: data.effectiveDate
        ? new Date(data.effectiveDate).toISOString().split('T')[0]
        : undefined,
      endDate: data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : undefined,
    });

    if (!updated) {
      throw new ServiceError('Failed to update group member', 'UPDATE_FAILED', 500);
    }

    return this.transformMember({ member: updated });
  }

  async removeGroupMember(id: string): Promise<void> {
    await this.consolidationRepository.removeMember(id);
  }

  // ==========================================
  // Elimination Rules
  // ==========================================

  async getEliminationRules(
    groupId: string,
    filters: { isActive?: boolean; eliminationType?: string; isAutomatic?: boolean } = {}
  ): Promise<EliminationRule[]> {
    const results = await this.consolidationRepository.findEliminationRulesByGroupId(
      groupId,
      filters
    );
    return results.map((r) => ({
      id: r.id,
      groupId: r.groupId,
      name: r.name,
      description: r.description || undefined,
      eliminationType: r.eliminationType,
      sequenceNumber: r.sequenceNumber,
      sourceSubsidiaryId: r.sourceSubsidiaryId || undefined,
      sourceAccountId: r.sourceAccountId || undefined,
      sourceAccountPattern: r.sourceAccountPattern || undefined,
      targetSubsidiaryId: r.targetSubsidiaryId || undefined,
      targetAccountId: r.targetAccountId || undefined,
      targetAccountPattern: r.targetAccountPattern || undefined,
      eliminationDebitAccountId: r.eliminationDebitAccountId || undefined,
      eliminationCreditAccountId: r.eliminationCreditAccountId || undefined,
      isAutomatic: r.isAutomatic,
      isActive: r.isActive,
      effectiveDate: new Date(r.effectiveDate),
      endDate: r.endDate ? new Date(r.endDate) : undefined,
    }));
  }

  async createEliminationRule(data: CreateEliminationRuleInput): Promise<EliminationRule> {
    const rule = await this.consolidationRepository.createEliminationRule({
      groupId: data.groupId,
      name: data.name,
      description: data.description,
      eliminationType: data.eliminationType as any,
      sequenceNumber: data.sequenceNumber || 10,
      sourceSubsidiaryId: data.sourceSubsidiaryId,
      sourceAccountId: data.sourceAccountId,
      sourceAccountPattern: data.sourceAccountPattern,
      targetSubsidiaryId: data.targetSubsidiaryId,
      targetAccountId: data.targetAccountId,
      targetAccountPattern: data.targetAccountPattern,
      eliminationDebitAccountId: data.eliminationDebitAccountId,
      eliminationCreditAccountId: data.eliminationCreditAccountId,
      isAutomatic: data.isAutomatic ?? true,
      effectiveDate: new Date(data.effectiveDate).toISOString().split('T')[0],
      endDate: data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : undefined,
    });

    return {
      id: rule.id,
      groupId: rule.groupId,
      name: rule.name,
      description: rule.description || undefined,
      eliminationType: rule.eliminationType,
      sequenceNumber: rule.sequenceNumber,
      sourceSubsidiaryId: rule.sourceSubsidiaryId || undefined,
      sourceAccountId: rule.sourceAccountId || undefined,
      sourceAccountPattern: rule.sourceAccountPattern || undefined,
      targetSubsidiaryId: rule.targetSubsidiaryId || undefined,
      targetAccountId: rule.targetAccountId || undefined,
      targetAccountPattern: rule.targetAccountPattern || undefined,
      eliminationDebitAccountId: rule.eliminationDebitAccountId || undefined,
      eliminationCreditAccountId: rule.eliminationCreditAccountId || undefined,
      isAutomatic: rule.isAutomatic,
      isActive: rule.isActive,
      effectiveDate: new Date(rule.effectiveDate),
      endDate: rule.endDate ? new Date(rule.endDate) : undefined,
    };
  }

  async updateEliminationRule(
    id: string,
    data: Partial<CreateEliminationRuleInput>
  ): Promise<EliminationRule> {
    const updated = await this.consolidationRepository.updateEliminationRule(id, {
      ...data,
      eliminationType: data.eliminationType as any,
      effectiveDate: data.effectiveDate
        ? new Date(data.effectiveDate).toISOString().split('T')[0]
        : undefined,
      endDate: data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : undefined,
    });

    if (!updated) {
      throw new ServiceError('Failed to update elimination rule', 'UPDATE_FAILED', 500);
    }

    return {
      id: updated.id,
      groupId: updated.groupId,
      name: updated.name,
      description: updated.description || undefined,
      eliminationType: updated.eliminationType,
      sequenceNumber: updated.sequenceNumber,
      sourceSubsidiaryId: updated.sourceSubsidiaryId || undefined,
      sourceAccountId: updated.sourceAccountId || undefined,
      sourceAccountPattern: updated.sourceAccountPattern || undefined,
      targetSubsidiaryId: updated.targetSubsidiaryId || undefined,
      targetAccountId: updated.targetAccountId || undefined,
      targetAccountPattern: updated.targetAccountPattern || undefined,
      eliminationDebitAccountId: updated.eliminationDebitAccountId || undefined,
      eliminationCreditAccountId: updated.eliminationCreditAccountId || undefined,
      isAutomatic: updated.isAutomatic,
      isActive: updated.isActive,
      effectiveDate: new Date(updated.effectiveDate),
      endDate: updated.endDate ? new Date(updated.endDate) : undefined,
    };
  }

  async deleteEliminationRule(id: string): Promise<void> {
    await this.consolidationRepository.deleteEliminationRule(id);
  }

  // ==========================================
  // Exchange Rates
  // ==========================================

  async getExchangeRatesByPeriod(periodId: string): Promise<ConsolidationExchangeRate[]> {
    const organizationId = this.requireOrganizationContext();
    const results = await this.consolidationRepository.findExchangeRatesByPeriod(
      organizationId,
      periodId
    );
    return results.map((r) => ({
      id: r.rate.id,
      organizationId: r.rate.organizationId,
      fromCurrencyId: r.rate.fromCurrencyId,
      toCurrencyId: r.rate.toCurrencyId,
      periodId: r.rate.periodId,
      rateType: r.rate.rateType,
      rate: r.rate.rate,
      rateDate: new Date(r.rate.rateDate),
      source: r.rate.source || undefined,
    }));
  }

  async upsertExchangeRate(data: CreateExchangeRateInput): Promise<ConsolidationExchangeRate> {
    const organizationId = this.requireOrganizationContext();

    if (data.organizationId !== organizationId) {
      throw new ServiceError(
        'Organization ID must match the current context',
        'INVALID_ORGANIZATION_ID',
        400
      );
    }

    const rate = await this.consolidationRepository.upsertExchangeRate({
      organizationId,
      fromCurrencyId: data.fromCurrencyId,
      toCurrencyId: data.toCurrencyId,
      periodId: data.periodId,
      rateType: data.rateType,
      rate: data.rate.toString(),
      rateDate: new Date(data.rateDate).toISOString().split('T')[0],
      source: data.source,
    });

    return {
      id: rate.id,
      organizationId: rate.organizationId,
      fromCurrencyId: rate.fromCurrencyId,
      toCurrencyId: rate.toCurrencyId,
      periodId: rate.periodId,
      rateType: rate.rateType,
      rate: rate.rate,
      rateDate: new Date(rate.rateDate),
      source: rate.source || undefined,
    };
  }

  // ==========================================
  // Intercompany Mappings
  // ==========================================

  async getIntercompanyMappings(): Promise<IntercompanyMapping[]> {
    const organizationId = this.requireOrganizationContext();
    const results = await this.consolidationRepository.findIntercompanyMappings(organizationId);
    return results.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      name: r.name,
      description: r.description || undefined,
      sourceAccountId: r.sourceAccountId,
      targetAccountId: r.targetAccountId,
      eliminationDebitAccountId: r.eliminationDebitAccountId || undefined,
      eliminationCreditAccountId: r.eliminationCreditAccountId || undefined,
      isActive: r.isActive,
    }));
  }

  async createIntercompanyMapping(
    data: CreateIntercompanyMappingInput
  ): Promise<IntercompanyMapping> {
    const organizationId = this.requireOrganizationContext();

    if (data.organizationId !== organizationId) {
      throw new ServiceError(
        'Organization ID must match the current context',
        'INVALID_ORGANIZATION_ID',
        400
      );
    }

    const mapping = await this.consolidationRepository.createIntercompanyMapping({
      organizationId,
      name: data.name,
      description: data.description,
      sourceAccountId: data.sourceAccountId,
      targetAccountId: data.targetAccountId,
      eliminationDebitAccountId: data.eliminationDebitAccountId,
      eliminationCreditAccountId: data.eliminationCreditAccountId,
    });

    return {
      id: mapping.id,
      organizationId: mapping.organizationId,
      name: mapping.name,
      description: mapping.description || undefined,
      sourceAccountId: mapping.sourceAccountId,
      targetAccountId: mapping.targetAccountId,
      eliminationDebitAccountId: mapping.eliminationDebitAccountId || undefined,
      eliminationCreditAccountId: mapping.eliminationCreditAccountId || undefined,
      isActive: mapping.isActive,
    };
  }

  async updateIntercompanyMapping(
    id: string,
    data: Partial<CreateIntercompanyMappingInput>
  ): Promise<IntercompanyMapping> {
    const organizationId = this.requireOrganizationContext();

    const updated = await this.consolidationRepository.updateIntercompanyMapping(
      id,
      data,
      organizationId
    );

    if (!updated) {
      throw new ServiceError('Failed to update intercompany mapping', 'UPDATE_FAILED', 500);
    }

    return {
      id: updated.id,
      organizationId: updated.organizationId,
      name: updated.name,
      description: updated.description || undefined,
      sourceAccountId: updated.sourceAccountId,
      targetAccountId: updated.targetAccountId,
      eliminationDebitAccountId: updated.eliminationDebitAccountId || undefined,
      eliminationCreditAccountId: updated.eliminationCreditAccountId || undefined,
      isActive: updated.isActive,
    };
  }

  async deleteIntercompanyMapping(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    await this.consolidationRepository.deleteIntercompanyMapping(id, organizationId);
  }

  // ==========================================
  // Group Summary (Dashboard)
  // ==========================================

  async getGroupSummary(groupId: string, periodId: string) {
    return this.consolidationRepository.getGroupSummary(groupId, periodId);
  }
}
