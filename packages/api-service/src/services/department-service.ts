import { BaseService } from './base-service';
import {
  Department,
  CreateDepartmentInput,
  UpdateDepartmentInput,
  PaginationParams,
  PaginatedResult,
  ServiceError
} from '../types';
import { DepartmentRepository, type ContextualDatabase } from '@glapi/database';

export interface DepartmentServiceOptions {
  db?: ContextualDatabase;
}

export class DepartmentService extends BaseService {
  private departmentRepository: DepartmentRepository;

  constructor(context = {}, options: DepartmentServiceOptions = {}) {
    super(context);
    // Pass the contextual db to the repository for RLS support
    this.departmentRepository = new DepartmentRepository(options.db);
  }
  /**
   * Transform database department to service layer type
   */
  private transformDepartment(dbDepartment: any): Department {
    return {
      id: dbDepartment.id,
      organizationId: dbDepartment.organizationId,
      subsidiaryId: dbDepartment.subsidiaryId,
      name: dbDepartment.name,
      code: dbDepartment.departmentCode,
      description: dbDepartment.description || undefined,
      isActive: dbDepartment.status === 'active',
      createdAt: dbDepartment.createdAt || new Date(),
      updatedAt: dbDepartment.updatedAt || new Date(),
    };
  }

  /**
   * Get a list of departments for the current organization
   */
  async listDepartments(
    params: PaginationParams = {},
    sortField: string = 'name',
    sortOrder: 'asc' | 'desc' = 'asc',
    filters: { subsidiaryId?: string } = {}
  ): Promise<PaginatedResult<Department>> {
    const organizationId = this.requireOrganizationContext();
    const { page, limit } = this.getPaginationParams(params);
    
    // If subsidiaryId filter is provided, use findBySubsidiary
    if (filters.subsidiaryId) {
      const departments = await this.departmentRepository.findBySubsidiary(
        filters.subsidiaryId, 
        organizationId
      );
      
      // Manual pagination for the subsidiary filter case
      const startIdx = (page - 1) * limit;
      const endIdx = startIdx + limit;
      const paginatedDepartments = departments.slice(startIdx, endIdx);
      
      return this.createPaginatedResult(
        paginatedDepartments.map(d => this.transformDepartment(d)), 
        departments.length, 
        page, 
        limit
      );
    }
    
    // Regular paginated query
    const result = await this.departmentRepository.findAll(
      organizationId,
      page,
      limit,
      sortField,
      sortOrder
    );
    
    return {
      data: result.departments.map(d => this.transformDepartment(d)),
      total: result.totalCount,
      page,
      limit,
      totalPages: Math.ceil(result.totalCount / limit)
    };
  }
  
  /**
   * Get a department by ID
   */
  async getDepartmentById(id: string): Promise<Department | null> {
    const organizationId = this.requireOrganizationContext();
    const department = await this.departmentRepository.findById(id, organizationId);
    return department ? this.transformDepartment(department) : null;
  }
  
  /**
   * Create a new department
   */
  async createDepartment(data: CreateDepartmentInput): Promise<Department> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate that the organization ID matches the context
    if (data.organizationId !== organizationId) {
      throw new ServiceError(
        'OrganizationId must match the current context',
        'INVALID_ORGANIZATION_ID',
        400
      );
    }
    
    // Create the department
    const department = await this.departmentRepository.create({
      name: data.name,
      organizationId: data.organizationId,
      code: data.code,
      description: data.description,
      subsidiaryId: data.subsidiaryId,
      isActive: data.isActive
    });
    return this.transformDepartment(department);
  }
  
  /**
   * Update an existing department
   */
  async updateDepartment(id: string, data: UpdateDepartmentInput): Promise<Department> {
    const organizationId = this.requireOrganizationContext();
    
    // Check if department exists and belongs to the organization
    const existing = await this.getDepartmentById(id);
    if (!existing) {
      throw new ServiceError(
        `Department with ID "${id}" not found`,
        'DEPARTMENT_NOT_FOUND',
        404
      );
    }
    
    // Update the department
    const updated = await this.departmentRepository.update(id, data, organizationId);
    
    if (!updated) {
      throw new ServiceError(
        `Failed to update department with ID "${id}"`,
        'UPDATE_FAILED',
        500
      );
    }
    
    return this.transformDepartment(updated);
  }
  
  /**
   * Delete a department
   */
  async deleteDepartment(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    // Check if department exists and belongs to the organization
    const existing = await this.getDepartmentById(id);
    if (!existing) {
      throw new ServiceError(
        `Department with ID "${id}" not found`,
        'DEPARTMENT_NOT_FOUND',
        404
      );
    }
    
    // Delete the department
    const success = await this.departmentRepository.delete(id, organizationId);
    
    if (!success) {
      throw new ServiceError(
        `Failed to delete department with ID "${id}"`,
        'DELETE_FAILED',
        500
      );
    }
  }
}