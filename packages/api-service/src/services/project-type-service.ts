import { BaseService } from './base-service';
import { ServiceError } from '../types/common.types';
import { ProjectTypeRepository, type ContextualDatabase } from '@glapi/database';

export interface ProjectType {
  id: string;
  organizationId: string;
  subsidiaryId: string | null;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTypeListParams {
  page?: number;
  limit?: number;
  sortField?: 'name' | 'code' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ProjectTypeFilters {
  subsidiaryId?: string;
  isActive?: boolean;
  search?: string;
}

export interface CreateProjectTypeInput {
  subsidiaryId?: string;
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateProjectTypeInput {
  subsidiaryId?: string | null;
  code?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface ProjectTypeServiceOptions {
  db?: ContextualDatabase;
}

export class ProjectTypeService extends BaseService {
  private projectTypeRepository: ProjectTypeRepository;

  constructor(context = {}, options: ProjectTypeServiceOptions = {}) {
    super(context);
    this.projectTypeRepository = new ProjectTypeRepository(options.db);
  }

  /**
   * List project types with pagination and filtering
   */
  async listProjectTypes(
    params: ProjectTypeListParams = {},
    filters: ProjectTypeFilters = {}
  ): Promise<{
    data: ProjectType[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const organizationId = this.requireOrganizationContext();

    const result = await this.projectTypeRepository.findAll(organizationId, params, filters);

    return {
      ...result,
      data: result.data.map(this.mapProjectTypeToDto),
    };
  }

  /**
   * Get a project type by ID
   */
  async getProjectTypeById(id: string): Promise<ProjectType> {
    const organizationId = this.requireOrganizationContext();

    const projectType = await this.projectTypeRepository.findById(id, organizationId);

    if (!projectType) {
      throw new ServiceError('Project type not found', 'PROJECT_TYPE_NOT_FOUND', 404);
    }

    return this.mapProjectTypeToDto(projectType);
  }

  /**
   * Get a project type by code
   */
  async getProjectTypeByCode(code: string): Promise<ProjectType> {
    const organizationId = this.requireOrganizationContext();

    const projectType = await this.projectTypeRepository.findByCode(code, organizationId);

    if (!projectType) {
      throw new ServiceError('Project type not found', 'PROJECT_TYPE_NOT_FOUND', 404);
    }

    return this.mapProjectTypeToDto(projectType);
  }

  /**
   * Create a new project type
   */
  async createProjectType(input: CreateProjectTypeInput): Promise<ProjectType> {
    const organizationId = this.requireOrganizationContext();

    // Validate code uniqueness
    const exists = await this.projectTypeRepository.existsByCode(input.code, organizationId);
    if (exists) {
      throw new ServiceError(
        `Project type code "${input.code}" already exists`,
        'PROJECT_TYPE_CODE_EXISTS',
        400
      );
    }

    const projectType = await this.projectTypeRepository.create({
      organizationId,
      ...input,
    });

    return this.mapProjectTypeToDto(projectType);
  }

  /**
   * Create a project type if it doesn't exist (for on-the-fly creation)
   * Returns the existing project type if one with the same code already exists
   */
  async findOrCreateProjectType(input: CreateProjectTypeInput): Promise<{ projectType: ProjectType; created: boolean }> {
    const organizationId = this.requireOrganizationContext();

    // Check if it already exists
    const existing = await this.projectTypeRepository.findByCode(input.code, organizationId);
    if (existing) {
      return { projectType: this.mapProjectTypeToDto(existing), created: false };
    }

    // Create new
    const projectType = await this.projectTypeRepository.create({
      organizationId,
      ...input,
    });

    return { projectType: this.mapProjectTypeToDto(projectType), created: true };
  }

  /**
   * Update a project type
   */
  async updateProjectType(id: string, input: UpdateProjectTypeInput): Promise<ProjectType> {
    const organizationId = this.requireOrganizationContext();

    // Verify project type exists
    const existing = await this.projectTypeRepository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError('Project type not found', 'PROJECT_TYPE_NOT_FOUND', 404);
    }

    // Validate code uniqueness if changing
    if (input.code && input.code !== existing.code) {
      const codeExists = await this.projectTypeRepository.existsByCode(
        input.code,
        organizationId,
        id
      );
      if (codeExists) {
        throw new ServiceError(
          `Project type code "${input.code}" already exists`,
          'PROJECT_TYPE_CODE_EXISTS',
          400
        );
      }
    }

    const updated = await this.projectTypeRepository.update(id, organizationId, input);

    if (!updated) {
      throw new ServiceError('Failed to update project type', 'UPDATE_FAILED', 500);
    }

    return this.mapProjectTypeToDto(updated);
  }

  /**
   * Delete a project type
   */
  async deleteProjectType(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    // Verify project type exists
    const existing = await this.projectTypeRepository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError('Project type not found', 'PROJECT_TYPE_NOT_FOUND', 404);
    }

    // TODO: Add validation for projects using this type
    // For now, allow deletion - could soft delete by setting isActive = false

    const deleted = await this.projectTypeRepository.delete(id, organizationId);
    if (!deleted) {
      throw new ServiceError('Failed to delete project type', 'DELETE_FAILED', 500);
    }
  }

  /**
   * Get project types for a specific subsidiary
   */
  async getProjectTypesBySubsidiary(subsidiaryId: string, activeOnly = true): Promise<ProjectType[]> {
    const organizationId = this.requireOrganizationContext();

    const projectTypes = await this.projectTypeRepository.findBySubsidiary(
      subsidiaryId,
      organizationId,
      activeOnly
    );

    return projectTypes.map(this.mapProjectTypeToDto);
  }

  // ========== Private Helpers ==========

  private mapProjectTypeToDto(row: any): ProjectType {
    return {
      id: row.id,
      organizationId: row.organizationId,
      subsidiaryId: row.subsidiaryId,
      code: row.code,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    };
  }
}
