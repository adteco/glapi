import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { departments } from '../db/schema/departments';
export type Department = InferSelectModel<typeof departments>;
export type NewDepartment = InferInsertModel<typeof departments>;
/**
 * Repository for managing department entities
 */
export declare class DepartmentRepository extends BaseRepository {
    /**
     * Find all departments belonging to an organization
     * @param organizationId The organization ID
     * @param page Page number for pagination
     * @param limit Number of records per page
     * @param sortField Field to sort by
     * @param sortOrder Sort direction ('asc' or 'desc')
     * @returns Array of departments and total count
     */
    findAll(organizationId: string, page?: number, limit?: number, sortField?: string, sortOrder?: 'asc' | 'desc'): Promise<{
        departments: Department[];
        totalCount: number;
    }>;
    /**
     * Find a department by ID
     * @param id Department ID
     * @param organizationId Organization ID
     * @returns Department or null if not found
     */
    findById(id: string, organizationId: string): Promise<Department | null>;
    /**
     * Find departments by subsidiary ID
     * @param subsidiaryId Subsidiary ID
     * @param organizationId Organization ID
     * @returns Array of departments
     */
    findBySubsidiary(subsidiaryId: string, organizationId: string): Promise<Department[]>;
    /**
     * Create a new department
     * @param department Department data
     * @returns The created department
     */
    create(department: NewDepartment): Promise<Department>;
    /**
     * Update a department
     * @param id Department ID
     * @param department Department data to update
     * @param organizationId Organization ID
     * @returns The updated department or null if not found
     */
    update(id: string, department: Partial<NewDepartment>, organizationId: string): Promise<Department | null>;
    /**
     * Delete a department
     * @param id Department ID
     * @param organizationId Organization ID
     * @returns Boolean indicating success
     */
    delete(id: string, organizationId: string): Promise<boolean>;
}
//# sourceMappingURL=department-repository.d.ts.map