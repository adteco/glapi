import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { classes } from '../db/schema/classes';
export type Class = InferSelectModel<typeof classes>;
export type NewClass = InferInsertModel<typeof classes>;
/**
 * Repository for managing class entities
 */
export declare class ClassRepository extends BaseRepository {
    /**
     * Find all classes belonging to an organization
     * @param organizationId The organization ID
     * @param page Page number for pagination
     * @param limit Number of records per page
     * @param sortField Field to sort by
     * @param sortOrder Sort direction ('asc' or 'desc')
     * @returns Array of classes and total count
     */
    findAll(organizationId: string, page?: number, limit?: number, sortField?: string, sortOrder?: 'asc' | 'desc'): Promise<{
        classes: Class[];
        totalCount: number;
    }>;
    /**
     * Find a class by ID
     * @param id Class ID
     * @param organizationId Organization ID
     * @returns Class or null if not found
     */
    findById(id: string, organizationId: string): Promise<Class | null>;
    /**
     * Find classes by subsidiary ID
     * @param subsidiaryId Subsidiary ID
     * @param organizationId Organization ID
     * @returns Array of classes
     */
    findBySubsidiary(subsidiaryId: string, organizationId: string): Promise<Class[]>;
    /**
     * Create a new class
     * @param classData Class data
     * @returns The created class
     */
    create(classData: NewClass): Promise<Class>;
    /**
     * Update a class
     * @param id Class ID
     * @param classData Class data to update
     * @param organizationId Organization ID
     * @returns The updated class or null if not found
     */
    update(id: string, classData: Partial<NewClass>, organizationId: string): Promise<Class | null>;
    /**
     * Delete a class
     * @param id Class ID
     * @param organizationId Organization ID
     * @returns Boolean indicating success
     */
    delete(id: string, organizationId: string): Promise<boolean>;
}
//# sourceMappingURL=class-repository.d.ts.map