import { and, eq, sql, desc, asc, InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { locations } from '../db/schema/locations';
import { subsidiaries } from '../db/schema/subsidiaries';

export type Location = InferSelectModel<typeof locations>;
export type NewLocation = InferInsertModel<typeof locations>;

/**
 * Repository for managing location entities
 */
export class LocationRepository extends BaseRepository {
  /**
   * Find all locations belonging to an organization
   * @param organizationId The organization ID
   * @param page Page number for pagination
   * @param limit Number of records per page
   * @param sortField Field to sort by
   * @param sortOrder Sort direction ('asc' or 'desc')
   * @returns Array of locations and total count
   */
  async findAll(
    organizationId: string,
    page = 1,
    limit = 20,
    sortField = 'name',
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Promise<{ locations: Location[]; totalCount: number }> {
    const offset = (page - 1) * limit;
    
    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(locations)
      .where(eq(locations.organizationId, organizationId));
    
    const totalCount = Number(countResult[0]?.count || 0);
    
    // Get sorted results with pagination
    let query = this.db
      .select()
      .from(locations)
      .where(eq(locations.organizationId, organizationId))
      .limit(limit)
      .offset(offset);
    
    // Handle sorting
    if (sortField in locations) {
      const sortColumn = locations[sortField as keyof typeof locations];
      query = sortOrder === 'desc' 
        ? query.orderBy(desc(sortColumn))
        : query.orderBy(asc(sortColumn));
    } else {
      query = sortOrder === 'desc'
        ? query.orderBy(desc(locations.name))
        : query.orderBy(asc(locations.name));
    }
    
    const result = await query;
    
    return {
      locations: result,
      totalCount
    };
  }

  /**
   * Find a location by ID
   * @param id Location ID
   * @param organizationId Organization ID
   * @returns Location or null if not found
   */
  async findById(id: string, organizationId: string): Promise<Location | null> {
    const [result] = await this.db
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.id, id),
          eq(locations.organizationId, organizationId)
        )
      )
      .limit(1);
      
    return result || null;
  }

  /**
   * Find locations by subsidiary ID
   * @param subsidiaryId Subsidiary ID
   * @param organizationId Organization ID
   * @returns Array of locations
   */
  async findBySubsidiary(subsidiaryId: string, organizationId: string): Promise<Location[]> {
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
      .from(locations)
      .where(
        and(
          eq(locations.subsidiaryId, subsidiaryId),
          eq(locations.organizationId, organizationId)
        )
      )
      .orderBy(asc(locations.name));
      
    return result;
  }

  /**
   * Create a new location
   * @param location Location data
   * @returns The created location
   */
  async create(location: NewLocation): Promise<Location> {
    const [result] = await this.db
      .insert(locations)
      .values(location)
      .returning();
      
    return result;
  }

  /**
   * Update a location
   * @param id Location ID
   * @param location Location data to update
   * @param organizationId Organization ID
   * @returns The updated location or null if not found
   */
  async update(id: string, location: Partial<NewLocation>, organizationId: string): Promise<Location | null> {
    // Verify the location exists and belongs to this organization
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      return null;
    }
    
    const [result] = await this.db
      .update(locations)
      .set({
        ...location,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(locations.id, id),
          eq(locations.organizationId, organizationId)
        )
      )
      .returning();
      
    return result;
  }

  /**
   * Delete a location
   * @param id Location ID
   * @param organizationId Organization ID
   * @returns Boolean indicating success
   */
  async delete(id: string, organizationId: string): Promise<boolean> {
    // Verify the location exists and belongs to this organization
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      return false;
    }
    
    const result = await this.db
      .delete(locations)
      .where(
        and(
          eq(locations.id, id),
          eq(locations.organizationId, organizationId)
        )
      );
      
    return true;
  }
}