import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { locations } from '../db/schema/locations';
export type Location = InferSelectModel<typeof locations>;
export type NewLocation = InferInsertModel<typeof locations>;
/**
 * Repository for managing location entities
 */
export declare class LocationRepository extends BaseRepository {
    /**
     * Find all locations belonging to an organization
     * @param organizationId The organization ID
     * @param page Page number for pagination
     * @param limit Number of records per page
     * @param sortField Field to sort by
     * @param sortOrder Sort direction ('asc' or 'desc')
     * @returns Array of locations and total count
     */
    findAll(organizationId: string, page?: number, limit?: number, sortField?: string, sortOrder?: 'asc' | 'desc'): Promise<{
        locations: Location[];
        totalCount: number;
    }>;
    /**
     * Find a location by ID
     * @param id Location ID
     * @param organizationId Organization ID
     * @returns Location or null if not found
     */
    findById(id: string, organizationId: string): Promise<Location | null>;
    /**
     * Find locations by subsidiary ID
     * @param subsidiaryId Subsidiary ID
     * @param organizationId Organization ID
     * @returns Array of locations
     */
    findBySubsidiary(subsidiaryId: string, organizationId: string): Promise<Location[]>;
    /**
     * Create a new location
     * @param location Location data
     * @returns The created location
     */
    create(location: NewLocation): Promise<Location>;
    /**
     * Update a location
     * @param id Location ID
     * @param location Location data to update
     * @param organizationId Organization ID
     * @returns The updated location or null if not found
     */
    update(id: string, location: Partial<NewLocation>, organizationId: string): Promise<Location | null>;
    /**
     * Delete a location
     * @param id Location ID
     * @param organizationId Organization ID
     * @returns Boolean indicating success
     */
    delete(id: string, organizationId: string): Promise<boolean>;
}
//# sourceMappingURL=location-repository.d.ts.map