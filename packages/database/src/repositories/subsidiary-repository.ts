import { and, asc, desc, eq, sql, isNull } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { subsidiaries } from '../db/schema/subsidiaries';

export interface SubsidiaryPaginationParams {
  page?: number;
  limit?: number;
  orderBy?: 'name' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
}

export class SubsidiaryRepository extends BaseRepository {
  /**
   * Find a subsidiary by ID with organization context
   */
  async findById(id: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(subsidiaries)
      .where(
        and(
          eq(subsidiaries.id, id),
          eq(subsidiaries.organizationId, organizationId)
        )
      )
      .limit(1);
    
    return result || null;
  }
  
  /**
   * Find all subsidiaries for an organization with pagination and filtering
   */
  async findAll(
    organizationId: string,
    params: SubsidiaryPaginationParams = {},
    filters: { isActive?: boolean; parentId?: string | null } = {}
  ) {
    // Calculate pagination
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;
    
    // Build the where clause
    const whereConditions = [eq(subsidiaries.organizationId, organizationId)];
    
    if (filters.isActive !== undefined) {
      whereConditions.push(eq(subsidiaries.isActive, filters.isActive));
    }
    
    if (filters.parentId !== undefined) {
      if (filters.parentId === null) {
        whereConditions.push(isNull(subsidiaries.parentId));
      } else {
        whereConditions.push(eq(subsidiaries.parentId, filters.parentId));
      }
    }
    
    const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];
    
    // Get the total count
    const countResult = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(subsidiaries)
      .where(whereClause!);
    
    const count = Number(countResult[0]?.count || 0);
    
    // Get the paginated results with ordering
    const orderBy = params.orderBy || 'name';
    const orderDirection = params.orderDirection || 'asc';
    const orderColumn = orderBy === 'name' ? subsidiaries.name : subsidiaries.createdAt;
    const orderFunc = orderDirection === 'asc' ? asc : desc;
    
    const results = await this.db
      .select()
      .from(subsidiaries)
      .where(whereClause!)
      .orderBy(orderFunc(orderColumn))
      .limit(limit)
      .offset(skip);
    
    return {
      data: results,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    };
  }
  
  /**
   * Create a new subsidiary
   */
  async create(data: any) {
    const [result] = await this.db
      .insert(subsidiaries)
      .values(data)
      .returning();
    
    return result;
  }
  
  /**
   * Update an existing subsidiary
   */
  async update(id: string, data: any, organizationId: string) {
    const [result] = await this.db
      .update(subsidiaries)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(subsidiaries.id, id),
          eq(subsidiaries.organizationId, organizationId)
        )
      )
      .returning();
    
    return result || null;
  }
  
  /**
   * Delete a subsidiary
   */
  async delete(id: string, organizationId: string) {
    await this.db
      .delete(subsidiaries)
      .where(
        and(
          eq(subsidiaries.id, id),
          eq(subsidiaries.organizationId, organizationId)
        )
      );
  }
  
  /**
   * Find subsidiaries by parent ID
   */
  async findByParentId(parentId: string, organizationId: string) {
    const results = await this.db
      .select()
      .from(subsidiaries)
      .where(
        and(
          eq(subsidiaries.parentId, parentId),
          eq(subsidiaries.organizationId, organizationId)
        )
      );
    
    return results;
  }
  
  /**
   * Count child subsidiaries
   */
  async countChildren(id: string, organizationId: string) {
    const childCountResult = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(subsidiaries)
      .where(
        and(
          eq(subsidiaries.parentId, id),
          eq(subsidiaries.organizationId, organizationId)
        )
      );
    
    return Number(childCountResult[0]?.count || 0);
  }
  
  /**
   * Find a subsidiary by code
   */
  async findByCode(code: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(subsidiaries)
      .where(
        and(
          eq(subsidiaries.code, code),
          eq(subsidiaries.organizationId, organizationId)
        )
      )
      .limit(1);
    
    return result || null;
  }
}