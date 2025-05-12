import { and, eq, sql, desc, asc, InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { departments } from '../db/schema/departments';
import { subsidiaries } from '../db/schema/subsidiaries';

export type Department = InferSelectModel<typeof departments>;
export type NewDepartment = InferInsertModel<typeof departments>;

/**
 * Repository for managing department entities
 */
export class DepartmentRepository extends BaseRepository {
  /**
   * Find all departments belonging to an organization
   * @param organizationId The organization ID
   * @param page Page number for pagination
   * @param limit Number of records per page
   * @param sortField Field to sort by
   * @param sortOrder Sort direction ('asc' or 'desc')
   * @returns Array of departments and total count
   */
  async findAll(
    organizationId: string,
    page = 1,
    limit = 20,
    sortField = 'name',
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Promise<{ departments: Department[]; totalCount: number }> {
    const offset = (page - 1) * limit;
    
    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(departments)
      .where(eq(departments.organizationId, organizationId));
    
    const totalCount = Number(countResult[0]?.count || 0);
    
    // Get sorted results with pagination
    let query = this.db
      .select()
      .from(departments)
      .where(eq(departments.organizationId, organizationId))
      .limit(limit)
      .offset(offset);
    
    // Handle sorting
    if (sortField in departments) {
      const sortColumn = departments[sortField as keyof typeof departments];
      query = sortOrder === 'desc' 
        ? query.orderBy(desc(sortColumn))
        : query.orderBy(asc(sortColumn));
    } else {
      query = sortOrder === 'desc'
        ? query.orderBy(desc(departments.name))
        : query.orderBy(asc(departments.name));
    }
    
    const result = await query;
    
    return {
      departments: result,
      totalCount
    };
  }

  /**
   * Find a department by ID
   * @param id Department ID
   * @param organizationId Organization ID
   * @returns Department or null if not found
   */
  async findById(id: string, organizationId: string): Promise<Department | null> {
    const [result] = await this.db
      .select()
      .from(departments)
      .where(
        and(
          eq(departments.id, id),
          eq(departments.organizationId, organizationId)
        )
      )
      .limit(1);
      
    return result || null;
  }

  /**
   * Find departments by subsidiary ID
   * @param subsidiaryId Subsidiary ID
   * @param organizationId Organization ID
   * @returns Array of departments
   */
  async findBySubsidiary(subsidiaryId: string, organizationId: string): Promise<Department[]> {
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
      .from(departments)
      .where(
        and(
          eq(departments.subsidiaryId, subsidiaryId),
          eq(departments.organizationId, organizationId)
        )
      )
      .orderBy(asc(departments.name));
      
    return result;
  }

  /**
   * Create a new department
   * @param department Department data
   * @returns The created department
   */
  async create(department: NewDepartment): Promise<Department> {
    const [result] = await this.db
      .insert(departments)
      .values(department)
      .returning();
      
    return result;
  }

  /**
   * Update a department
   * @param id Department ID
   * @param department Department data to update
   * @param organizationId Organization ID
   * @returns The updated department or null if not found
   */
  async update(id: string, department: Partial<NewDepartment>, organizationId: string): Promise<Department | null> {
    // Verify the department exists and belongs to this organization
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      return null;
    }
    
    const [result] = await this.db
      .update(departments)
      .set({
        ...department,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(departments.id, id),
          eq(departments.organizationId, organizationId)
        )
      )
      .returning();
      
    return result;
  }

  /**
   * Delete a department
   * @param id Department ID
   * @param organizationId Organization ID
   * @returns Boolean indicating success
   */
  async delete(id: string, organizationId: string): Promise<boolean> {
    // Verify the department exists and belongs to this organization
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      return false;
    }
    
    const result = await this.db
      .delete(departments)
      .where(
        and(
          eq(departments.id, id),
          eq(departments.organizationId, organizationId)
        )
      );
      
    return true;
  }
}