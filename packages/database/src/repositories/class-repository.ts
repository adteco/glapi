import { and, eq, sql, desc, asc, InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { classes } from '../db/schema/classes';
import { subsidiaries } from '../db/schema/subsidiaries';

export type Class = InferSelectModel<typeof classes>;
export type NewClass = InferInsertModel<typeof classes>;

/**
 * Repository for managing class entities
 */
export class ClassRepository extends BaseRepository {
  /**
   * Find all classes belonging to an organization
   * @param organizationId The organization ID
   * @param page Page number for pagination
   * @param limit Number of records per page
   * @param sortField Field to sort by
   * @param sortOrder Sort direction ('asc' or 'desc')
   * @returns Array of classes and total count
   */
  async findAll(
    organizationId: string,
    page = 1,
    limit = 20,
    sortField = 'name',
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Promise<{ classes: Class[]; totalCount: number }> {
    const offset = (page - 1) * limit;
    
    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(classes)
      .where(eq(classes.organizationId, organizationId));
    
    const totalCount = Number(countResult[0]?.count || 0);
    
    // Determine sort column
    let sortColumn;
    if (sortField === 'name') {
      sortColumn = classes.name;
    } else if (sortField === 'code') {
      sortColumn = classes.code;
    } else if (sortField === 'createdAt') {
      sortColumn = classes.createdAt;
    } else {
      sortColumn = classes.name; // default
    }
    
    // Get sorted results with pagination
    const result = await this.db
      .select()
      .from(classes)
      .where(eq(classes.organizationId, organizationId))
      .orderBy(sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn))
      .limit(limit)
      .offset(offset);
    
    return {
      classes: result,
      totalCount
    };
  }

  /**
   * Find a class by ID
   * @param id Class ID
   * @param organizationId Organization ID
   * @returns Class or null if not found
   */
  async findById(id: string, organizationId: string): Promise<Class | null> {
    const [result] = await this.db
      .select()
      .from(classes)
      .where(
        and(
          eq(classes.id, id),
          eq(classes.organizationId, organizationId)
        )
      )
      .limit(1);
      
    return result || null;
  }

  /**
   * Find classes by subsidiary ID
   * @param subsidiaryId Subsidiary ID
   * @param organizationId Organization ID
   * @returns Array of classes
   */
  async findBySubsidiary(subsidiaryId: string, organizationId: string): Promise<Class[]> {
    // First verify the subsidiary belongs to the organization
    const subsidiaryBelongs = await this.belongsToOrganization(
      subsidiaries,
      subsidiaryId,
      organizationId
    );
    
    if (!subsidiaryBelongs) {
      return [];
    }
    
    const result = await this.db
      .select()
      .from(classes)
      .where(
        and(
          eq(classes.subsidiaryId, subsidiaryId),
          eq(classes.organizationId, organizationId)
        )
      )
      .orderBy(asc(classes.name));
      
    return result;
  }

  /**
   * Create a new class
   * @param classData Class data
   * @returns The created class
   */
  async create(classData: NewClass): Promise<Class> {
    const [result] = await this.db
      .insert(classes)
      .values(classData)
      .returning();
      
    return result;
  }

  /**
   * Update a class
   * @param id Class ID
   * @param classData Class data to update
   * @param organizationId Organization ID
   * @returns The updated class or null if not found
   */
  async update(id: string, classData: Partial<NewClass>, organizationId: string): Promise<Class | null> {
    // Verify the class exists and belongs to this organization
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      return null;
    }
    
    const [result] = await this.db
      .update(classes)
      .set({
        ...classData,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(classes.id, id),
          eq(classes.organizationId, organizationId)
        )
      )
      .returning();
      
    return result;
  }

  /**
   * Delete a class
   * @param id Class ID
   * @param organizationId Organization ID
   * @returns Boolean indicating success
   */
  async delete(id: string, organizationId: string): Promise<boolean> {
    // Verify the class exists and belongs to this organization
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      return false;
    }
    
    await this.db
      .delete(classes)
      .where(
        and(
          eq(classes.id, id),
          eq(classes.organizationId, organizationId)
        )
      );
      
    return true;
  }
}