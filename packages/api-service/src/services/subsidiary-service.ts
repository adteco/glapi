import { BaseService } from './base-service';
import { 
  Subsidiary, 
  CreateSubsidiaryInput, 
  UpdateSubsidiaryInput, 
  PaginationParams, 
  PaginatedResult,
  ServiceError
} from '../types';
import { SubsidiaryRepository } from '@glapi/database';

export class SubsidiaryService extends BaseService {
  private subsidiaryRepository: SubsidiaryRepository;
  
  constructor(context = {}) {
    super(context);
    this.subsidiaryRepository = new SubsidiaryRepository();
  }
  
  /**
   * Transform database subsidiary to service layer type
   */
  private transformSubsidiary(dbSubsidiary: any): Subsidiary {
    return {
      id: dbSubsidiary.id,
      organizationId: dbSubsidiary.organizationId,
      parentId: dbSubsidiary.parentId || undefined,
      name: dbSubsidiary.name,
      code: dbSubsidiary.code,
      description: dbSubsidiary.description || undefined,
      isActive: dbSubsidiary.isActive,
      createdAt: dbSubsidiary.createdAt || new Date(),
      updatedAt: dbSubsidiary.updatedAt || new Date(),
    };
  }
  
  /**
   * Get a list of subsidiaries for the current organization
   */
  async listSubsidiaries(
    params: PaginationParams = {},
    orderBy: 'name' | 'createdAt' = 'name',
    orderDirection: 'asc' | 'desc' = 'asc',
    filters: { isActive?: boolean; parentId?: string | null } = {}
  ): Promise<PaginatedResult<Subsidiary>> {
    const organizationId = this.requireOrganizationContext();
    
    const result = await this.subsidiaryRepository.findAll(
      organizationId,
      {
        page: params.page,
        limit: params.limit,
        orderBy,
        orderDirection
      },
      filters
    );
    
    return {
      ...result,
      data: result.data.map(s => this.transformSubsidiary(s))
    };
  }
  
  /**
   * Get a subsidiary by ID
   */
  async getSubsidiaryById(id: string): Promise<Subsidiary | null> {
    const organizationId = this.requireOrganizationContext();
    const subsidiary = await this.subsidiaryRepository.findById(id, organizationId);
    return subsidiary ? this.transformSubsidiary(subsidiary) : null;
  }
  
  /**
   * Create a new subsidiary
   */
  async createSubsidiary(data: CreateSubsidiaryInput): Promise<Subsidiary> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate that the organization ID matches the context
    if (data.organizationId !== organizationId) {
      throw new ServiceError(
        'OrganizationId must match the current context',
        'INVALID_ORGANIZATION_ID',
        400
      );
    }
    
    // Check if a subsidiary with the same code exists in this organization, only if code is provided
    if (typeof data.code === 'string' && data.code.trim() !== '') {
      const existing = await this.subsidiaryRepository.findByCode(data.code, organizationId);
      if (existing) {
        throw new ServiceError(
          `Subsidiary with code "${data.code}" already exists in this organization`,
          'DUPLICATE_SUBSIDIARY_CODE',
          400
        );
      }
    }
    
    // If parentId is provided, validate that it exists and belongs to the organization
    if (data.parentId) {
      const parentExists = await this.subsidiaryRepository.findById(data.parentId, organizationId);
      if (!parentExists) {
        throw new ServiceError(
          `Parent subsidiary with ID "${data.parentId}" not found`,
          'PARENT_SUBSIDIARY_NOT_FOUND',
          400
        );
      }
    }
    
    // Create the new subsidiary
    const subsidiary = await this.subsidiaryRepository.create(data);
    return this.transformSubsidiary(subsidiary);
  }
  
  /**
   * Update an existing subsidiary
   */
  async updateSubsidiary(id: string, data: UpdateSubsidiaryInput): Promise<Subsidiary> {
    const organizationId = this.requireOrganizationContext();
    
    // Check if subsidiary exists and belongs to the organization
    const existing = await this.subsidiaryRepository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError(
        `Subsidiary with ID "${id}" not found`,
        'SUBSIDIARY_NOT_FOUND',
        404
      );
    }
    
    // If code is being updated, check if it would create a duplicate
    if (data.code && data.code !== existing.code) {
      // For UpdateSubsidiaryInput, 'code' is 'string | null | undefined' as well.
      // We need a similar check here if data.code could be null/undefined but is being set.
      // If data.code is set to null/undefined, this check might not be needed or findByCode would fail.
      // Assuming if data.code is being set, it should be a string.
      if (typeof data.code === 'string' && data.code.trim() !== '') {
        const duplicateCode = await this.subsidiaryRepository.findByCode(data.code, organizationId);
        if (duplicateCode && duplicateCode.id !== id) {
          throw new ServiceError(
            `Subsidiary with code "${data.code}" already exists in this organization`,
            'DUPLICATE_SUBSIDIARY_CODE',
            400
          );
        }
      } else if (data.code === null || data.code === '') {
        // If attempting to set code to null or empty, this implies removing the code.
        // No uniqueness check needed for null/empty code in the same way.
        // Depending on business logic, you might want to check if other subsidiaries have null/empty code
        // if that should also be unique (usually not).
      }
    }
    
    // If parentId is being updated, validate that it exists and belongs to the organization
    // Also prevent circular references
    if (data.parentId !== undefined && data.parentId !== existing.parentId) {
      if (data.parentId === id) {
        throw new ServiceError(
          'A subsidiary cannot be its own parent',
          'INVALID_PARENT_REFERENCE',
          400
        );
      }
      
      if (data.parentId) {
        const parentExists = await this.subsidiaryRepository.findById(data.parentId, organizationId);
        if (!parentExists) {
          throw new ServiceError(
            `Parent subsidiary with ID "${data.parentId}" not found`,
            'PARENT_SUBSIDIARY_NOT_FOUND',
            400
          );
        }
        
        // Prevent circular references by checking parent chain
        let currentParentId = data.parentId;
        const visitedIds = new Set<string>();
        
        while (currentParentId) {
          if (visitedIds.has(currentParentId)) {
            throw new ServiceError(
              'Circular reference detected in subsidiary hierarchy',
              'CIRCULAR_REFERENCE',
              400
            );
          }
          
          visitedIds.add(currentParentId);
          
          const parent = await this.subsidiaryRepository.findById(currentParentId!, organizationId);
          if (!parent || !parent.parentId) {
            break;
          }
          
          currentParentId = parent.parentId;
        }
      }
    }
    
    // Update the subsidiary
    const result = await this.subsidiaryRepository.update(id, data, organizationId);
    
    if (!result) {
      throw new ServiceError(
        `Failed to update subsidiary with ID "${id}"`,
        'UPDATE_FAILED',
        500
      );
    }
    
    return this.transformSubsidiary(result);
  }
  
  /**
   * Delete a subsidiary
   */
  async deleteSubsidiary(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    // Check if subsidiary exists and belongs to the organization
    const existing = await this.subsidiaryRepository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError(
        `Subsidiary with ID "${id}" not found`,
        'SUBSIDIARY_NOT_FOUND',
        404
      );
    }
    
    // Check if this subsidiary has child subsidiaries
    const childCount = await this.subsidiaryRepository.countChildren(id, organizationId);
    
    if (childCount > 0) {
      throw new ServiceError(
        `Cannot delete subsidiary with ID "${id}" because it has child subsidiaries`,
        'SUBSIDIARY_HAS_CHILDREN',
        400
      );
    }
    
    // Delete the subsidiary
    await this.subsidiaryRepository.delete(id, organizationId);
  }
}