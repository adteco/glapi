import { and, eq, desc, asc } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  savedReportConfigs,
  SavedReportConfig,
  NewSavedReportConfig,
  SavedReportConfigJson,
  REPORT_TYPES,
  SavedReportType,
} from '../db/schema/saved-report-configs';

export interface SavedReportConfigFilters {
  reportType?: SavedReportType;
  isDefault?: boolean;
}

export interface ListSavedReportConfigsParams {
  page?: number;
  limit?: number;
  orderBy?: 'name' | 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
  filters?: SavedReportConfigFilters;
}

export class SavedReportConfigsRepository extends BaseRepository {
  /**
   * Find a saved report config by ID with organization/user RLS
   */
  async findById(
    id: string,
    organizationId: string,
    userId: string
  ): Promise<SavedReportConfig | null> {
    const [result] = await this.db
      .select()
      .from(savedReportConfigs)
      .where(
        and(
          eq(savedReportConfigs.id, id),
          eq(savedReportConfigs.organizationId, organizationId),
          eq(savedReportConfigs.userId, userId)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * Find all saved report configs for a user with filtering and pagination
   */
  async findAll(
    organizationId: string,
    userId: string,
    params: ListSavedReportConfigsParams = {}
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 50));
    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions = [
      eq(savedReportConfigs.organizationId, organizationId),
      eq(savedReportConfigs.userId, userId),
    ];

    if (params.filters?.reportType) {
      whereConditions.push(eq(savedReportConfigs.reportType, params.filters.reportType));
    }

    if (params.filters?.isDefault !== undefined) {
      whereConditions.push(eq(savedReportConfigs.isDefault, params.filters.isDefault));
    }

    const whereClause = and(...whereConditions);

    // Determine order
    let orderColumn;
    switch (params.orderBy) {
      case 'name':
        orderColumn = savedReportConfigs.name;
        break;
      case 'updatedAt':
        orderColumn = savedReportConfigs.updatedAt;
        break;
      case 'createdAt':
      default:
        orderColumn = savedReportConfigs.createdAt;
    }
    const orderFunc = params.orderDirection === 'asc' ? asc : desc;

    // Get count
    const countResult = await this.db
      .select({ count: savedReportConfigs.id })
      .from(savedReportConfigs)
      .where(whereClause);
    const total = countResult.length;

    // Get paginated results
    const results = await this.db
      .select()
      .from(savedReportConfigs)
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

  /**
   * Find the default config for a specific report type
   */
  async findDefault(
    organizationId: string,
    userId: string,
    reportType: SavedReportType
  ): Promise<SavedReportConfig | null> {
    const [result] = await this.db
      .select()
      .from(savedReportConfigs)
      .where(
        and(
          eq(savedReportConfigs.organizationId, organizationId),
          eq(savedReportConfigs.userId, userId),
          eq(savedReportConfigs.reportType, reportType),
          eq(savedReportConfigs.isDefault, true)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * Create a new saved report config
   */
  async create(
    data: Omit<NewSavedReportConfig, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SavedReportConfig> {
    // If this is being set as default, unset other defaults for this report type
    if (data.isDefault) {
      await this.unsetDefaults(data.organizationId, data.userId, data.reportType as SavedReportType);
    }

    const [result] = await this.db
      .insert(savedReportConfigs)
      .values(data)
      .returning();

    return result;
  }

  /**
   * Update an existing saved report config
   */
  async update(
    id: string,
    organizationId: string,
    userId: string,
    data: Partial<Pick<SavedReportConfig, 'name' | 'config' | 'isDefault'>>
  ): Promise<SavedReportConfig | null> {
    // First verify the record belongs to this user
    const existing = await this.findById(id, organizationId, userId);
    if (!existing) {
      return null;
    }

    // If setting as default, unset other defaults for this report type
    if (data.isDefault) {
      await this.unsetDefaults(organizationId, userId, existing.reportType as SavedReportType);
    }

    const [result] = await this.db
      .update(savedReportConfigs)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(savedReportConfigs.id, id),
          eq(savedReportConfigs.organizationId, organizationId),
          eq(savedReportConfigs.userId, userId)
        )
      )
      .returning();

    return result || null;
  }

  /**
   * Delete a saved report config
   */
  async delete(
    id: string,
    organizationId: string,
    userId: string
  ): Promise<boolean> {
    const result = await this.db
      .delete(savedReportConfigs)
      .where(
        and(
          eq(savedReportConfigs.id, id),
          eq(savedReportConfigs.organizationId, organizationId),
          eq(savedReportConfigs.userId, userId)
        )
      )
      .returning();

    return result.length > 0;
  }

  /**
   * Set a config as the default for its report type
   */
  async setAsDefault(
    id: string,
    organizationId: string,
    userId: string
  ): Promise<SavedReportConfig | null> {
    // First get the config to know its report type
    const config = await this.findById(id, organizationId, userId);
    if (!config) {
      return null;
    }

    // Unset any existing defaults for this report type
    await this.unsetDefaults(organizationId, userId, config.reportType as SavedReportType);

    // Set this one as default
    return this.update(id, organizationId, userId, { isDefault: true });
  }

  /**
   * Helper to unset all default configs for a report type
   */
  private async unsetDefaults(
    organizationId: string,
    userId: string,
    reportType: SavedReportType
  ): Promise<void> {
    await this.db
      .update(savedReportConfigs)
      .set({ isDefault: false })
      .where(
        and(
          eq(savedReportConfigs.organizationId, organizationId),
          eq(savedReportConfigs.userId, userId),
          eq(savedReportConfigs.reportType, reportType),
          eq(savedReportConfigs.isDefault, true)
        )
      );
  }

  /**
   * Check if a config name already exists for this user/report type
   */
  async nameExists(
    organizationId: string,
    userId: string,
    reportType: SavedReportType,
    name: string,
    excludeId?: string
  ): Promise<boolean> {
    const whereConditions = [
      eq(savedReportConfigs.organizationId, organizationId),
      eq(savedReportConfigs.userId, userId),
      eq(savedReportConfigs.reportType, reportType),
      eq(savedReportConfigs.name, name),
    ];

    const results = await this.db
      .select({ id: savedReportConfigs.id })
      .from(savedReportConfigs)
      .where(and(...whereConditions));

    // If excludeId is provided, check if the only match is that ID
    if (excludeId && results.length === 1 && results[0].id === excludeId) {
      return false;
    }

    return results.length > 0;
  }
}

// Export singleton instance
export const savedReportConfigsRepository = new SavedReportConfigsRepository();
