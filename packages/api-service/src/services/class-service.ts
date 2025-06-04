import { BaseService } from './base-service';
import { 
  Class, 
  CreateClassInput, 
  UpdateClassInput, 
  PaginationParams, 
  PaginatedResult,
  ServiceError
} from '../types';
import { classRepository } from '@glapi/database';

export class ClassService extends BaseService {
  /**
   * Transform database class to service layer type
   */
  private transformClass(dbClass: any): Class {
    return {
      id: dbClass.id,
      organizationId: dbClass.organizationId,
      subsidiaryId: dbClass.subsidiaryId,
      name: dbClass.name,
      code: dbClass.code || undefined,
      description: dbClass.description || undefined,
      isActive: dbClass.isActive ?? true,
      createdAt: dbClass.createdAt || new Date(),
      updatedAt: dbClass.updatedAt || new Date(),
    };
  }

  /**
   * Get a list of classes for the current organization
   */
  async listClasses(
    params: PaginationParams = {},
    sortField: string = 'name',
    sortOrder: 'asc' | 'desc' = 'asc',
    filters: { subsidiaryId?: string } = {}
  ): Promise<PaginatedResult<Class>> {
    const organizationId = this.requireOrganizationContext();
    const { page, limit } = this.getPaginationParams(params);
    
    // If subsidiaryId filter is provided, use findBySubsidiary
    if (filters.subsidiaryId) {
      const classes = await classRepository.findBySubsidiary(
        filters.subsidiaryId, 
        organizationId
      );
      
      // Manual pagination for the subsidiary filter case
      const startIdx = (page - 1) * limit;
      const endIdx = startIdx + limit;
      const paginatedClasses = classes.slice(startIdx, endIdx);
      
      return this.createPaginatedResult(
        paginatedClasses.map(c => this.transformClass(c)), 
        classes.length, 
        page, 
        limit
      );
    }
    
    // Regular paginated query
    const result = await classRepository.findAll(
      organizationId,
      page,
      limit,
      sortField,
      sortOrder
    );
    
    return {
      data: result.classes.map(c => this.transformClass(c)),
      total: result.totalCount,
      page,
      limit,
      totalPages: Math.ceil(result.totalCount / limit)
    };
  }
  
  /**
   * Get a class by ID
   */
  async getClassById(id: string): Promise<Class | null> {
    const organizationId = this.requireOrganizationContext();
    const cls = await classRepository.findById(id, organizationId);
    return cls ? this.transformClass(cls) : null;
  }
  
  /**
   * Create a new class
   */
  async createClass(data: CreateClassInput): Promise<Class> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate that the organization ID matches the context
    if (data.organizationId !== organizationId) {
      throw new ServiceError(
        'OrganizationId must match the current context',
        'INVALID_ORGANIZATION_ID',
        400
      );
    }
    
    // Create the class
    const created = await classRepository.create(data);
    return this.transformClass(created);
  }
  
  /**
   * Update an existing class
   */
  async updateClass(id: string, data: UpdateClassInput): Promise<Class> {
    const organizationId = this.requireOrganizationContext();
    
    // Check if class exists and belongs to the organization
    const existing = await this.getClassById(id);
    if (!existing) {
      throw new ServiceError(
        `Class with ID "${id}" not found`,
        'CLASS_NOT_FOUND',
        404
      );
    }
    
    // Update the class
    const updated = await classRepository.update(id, data, organizationId);
    
    if (!updated) {
      throw new ServiceError(
        `Failed to update class with ID "${id}"`,
        'UPDATE_FAILED',
        500
      );
    }
    
    return this.transformClass(updated);
  }
  
  /**
   * Delete a class
   */
  async deleteClass(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    // Check if class exists and belongs to the organization
    const existing = await this.getClassById(id);
    if (!existing) {
      throw new ServiceError(
        `Class with ID "${id}" not found`,
        'CLASS_NOT_FOUND',
        404
      );
    }
    
    // Delete the class
    const success = await classRepository.delete(id, organizationId);
    
    if (!success) {
      throw new ServiceError(
        `Failed to delete class with ID "${id}"`,
        'DELETE_FAILED',
        500
      );
    }
  }
}