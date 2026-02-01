import { BaseService } from './base-service';
import { ServiceError } from '../types/common.types';
import { ProjectRepository, type ContextualDatabase } from '@glapi/database';

export interface Project {
  id: string;
  organizationId: string;
  subsidiaryId: string | null;
  customerId: string | null;
  customerName: string | null;
  projectCode: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  jobNumber: string | null;
  projectType: string | null;
  budgetRevenue: string | null;
  budgetCost: string | null;
  percentComplete: string | null;
  retainagePercent: string;
  currencyCode: string | null;
  description: string | null;
  externalSource: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectParticipant {
  id: string;
  projectId: string;
  entityId: string | null;
  participantRole: string;
  isPrimary: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListParams {
  page?: number;
  limit?: number;
  orderBy?: 'name' | 'projectCode' | 'status' | 'startDate' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
}

export interface ProjectFilters {
  subsidiaryId?: string;
  customerId?: string;
  status?: string | string[];
  projectType?: string;
  search?: string;
  startDateFrom?: string;
  startDateTo?: string;
}

export interface CreateProjectInput {
  subsidiaryId?: string;
  customerId?: string;
  projectCode: string;
  name: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  jobNumber?: string;
  projectType?: string;
  budgetRevenue?: string;
  budgetCost?: string;
  retainagePercent?: string;
  currencyCode?: string;
  description?: string;
  externalSource?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateProjectInput {
  subsidiaryId?: string;
  customerId?: string | null;
  projectCode?: string;
  name?: string;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  jobNumber?: string | null;
  projectType?: string | null;
  budgetRevenue?: string | null;
  budgetCost?: string | null;
  percentComplete?: string | null;
  retainagePercent?: string;
  currencyCode?: string | null;
  description?: string | null;
  externalSource?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateParticipantInput {
  entityId?: string;
  participantRole: string;
  isPrimary?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateParticipantInput {
  entityId?: string;
  participantRole?: string;
  isPrimary?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ProjectServiceOptions {
  db?: ContextualDatabase;
}

export class ProjectService extends BaseService {
  private projectRepository: ProjectRepository;

  constructor(context = {}, options: ProjectServiceOptions = {}) {
    super(context);
    // Pass the contextual db to the repository for RLS support
    this.projectRepository = new ProjectRepository(options.db);
  }

  /**
   * List projects with pagination and filtering
   */
  async listProjects(
    params: ProjectListParams = {},
    filters: ProjectFilters = {}
  ): Promise<{
    data: Project[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const organizationId = this.requireOrganizationContext();

    const result = await this.projectRepository.findAll(organizationId, params, filters);

    return {
      ...result,
      data: result.data.map(this.mapProjectToDto),
    };
  }

  /**
   * Get a project by ID
   */
  async getProjectById(id: string): Promise<Project> {
    const organizationId = this.requireOrganizationContext();

    const project = await this.projectRepository.findById(id, organizationId);

    if (!project) {
      throw new ServiceError('Project not found', 'PROJECT_NOT_FOUND', 404);
    }

    return this.mapProjectToDto(project);
  }

  /**
   * Get a project by code
   */
  async getProjectByCode(projectCode: string): Promise<Project> {
    const organizationId = this.requireOrganizationContext();

    const project = await this.projectRepository.findByCode(projectCode, organizationId);

    if (!project) {
      throw new ServiceError('Project not found', 'PROJECT_NOT_FOUND', 404);
    }

    return this.mapProjectToDto(project);
  }

  /**
   * Create a new project
   */
  async createProject(input: CreateProjectInput): Promise<Project> {
    const organizationId = this.requireOrganizationContext();

    // Validate project code uniqueness
    const exists = await this.projectRepository.existsByCode(input.projectCode, organizationId);
    if (exists) {
      throw new ServiceError(
        `Project code "${input.projectCode}" already exists`,
        'PROJECT_CODE_EXISTS',
        400
      );
    }

    // Validate dates if both provided
    if (input.startDate && input.endDate) {
      if (new Date(input.endDate) < new Date(input.startDate)) {
        throw new ServiceError('End date cannot be before start date', 'INVALID_DATE_RANGE', 400);
      }
    }

    const project = await this.projectRepository.create({
      organizationId,
      ...input,
    });

    return this.mapProjectToDto(project);
  }

  /**
   * Update a project
   */
  async updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
    const organizationId = this.requireOrganizationContext();

    // Verify project exists
    const existing = await this.projectRepository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError('Project not found', 'PROJECT_NOT_FOUND', 404);
    }

    // Validate project code uniqueness if changing
    if (input.projectCode && input.projectCode !== existing.projectCode) {
      const exists = await this.projectRepository.existsByCode(
        input.projectCode,
        organizationId,
        id
      );
      if (exists) {
        throw new ServiceError(
          `Project code "${input.projectCode}" already exists`,
          'PROJECT_CODE_EXISTS',
          400
        );
      }
    }

    // Validate dates
    const startDate = input.startDate !== undefined ? input.startDate : existing.startDate;
    const endDate = input.endDate !== undefined ? input.endDate : existing.endDate;
    if (startDate && endDate) {
      if (new Date(endDate) < new Date(startDate)) {
        throw new ServiceError('End date cannot be before start date', 'INVALID_DATE_RANGE', 400);
      }
    }

    const updated = await this.projectRepository.update(id, organizationId, input);

    if (!updated) {
      throw new ServiceError('Failed to update project', 'UPDATE_FAILED', 500);
    }

    return this.mapProjectToDto(updated);
  }

  /**
   * Delete a project
   */
  async deleteProject(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    // Verify project exists
    const existing = await this.projectRepository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError('Project not found', 'PROJECT_NOT_FOUND', 404);
    }

    // TODO: Add validation for related records (cost codes, budgets, time entries, etc.)
    // For now, allow deletion - database constraints will prevent if related data exists

    await this.projectRepository.delete(id, organizationId);
  }

  // ========== Participant Methods ==========

  /**
   * List participants for a project
   */
  async listParticipants(projectId: string): Promise<ProjectParticipant[]> {
    const organizationId = this.requireOrganizationContext();

    const participants = await this.projectRepository.findParticipants(projectId, organizationId);

    return participants.map(this.mapParticipantToDto);
  }

  /**
   * Add a participant to a project
   */
  async addParticipant(projectId: string, input: CreateParticipantInput): Promise<ProjectParticipant> {
    const organizationId = this.requireOrganizationContext();

    // Check for duplicate (this also validates project belongs to org)
    const exists = await this.projectRepository.participantExists(
      projectId,
      organizationId,
      input.participantRole,
      input.entityId
    );
    if (exists) {
      throw new ServiceError(
        'Participant with this role already exists on project',
        'PARTICIPANT_EXISTS',
        400
      );
    }

    const participant = await this.projectRepository.createParticipant({
      projectId,
      ...input,
    }, organizationId);

    if (!participant) {
      throw new ServiceError('Project not found', 'PROJECT_NOT_FOUND', 404);
    }

    return this.mapParticipantToDto(participant);
  }

  /**
   * Update a participant
   */
  async updateParticipant(
    projectId: string,
    participantId: string,
    input: UpdateParticipantInput
  ): Promise<ProjectParticipant> {
    const organizationId = this.requireOrganizationContext();

    // Verify participant exists and belongs to a project in this organization
    const existing = await this.projectRepository.findParticipantById(participantId, organizationId);
    if (!existing || existing.projectId !== projectId) {
      throw new ServiceError('Participant not found', 'PARTICIPANT_NOT_FOUND', 404);
    }

    const updated = await this.projectRepository.updateParticipant(participantId, organizationId, input);

    if (!updated) {
      throw new ServiceError('Failed to update participant', 'UPDATE_FAILED', 500);
    }

    return this.mapParticipantToDto(updated);
  }

  /**
   * Remove a participant from a project
   */
  async removeParticipant(projectId: string, participantId: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    // Verify participant exists and belongs to a project in this organization
    const existing = await this.projectRepository.findParticipantById(participantId, organizationId);
    if (!existing || existing.projectId !== projectId) {
      throw new ServiceError('Participant not found', 'PARTICIPANT_NOT_FOUND', 404);
    }

    const deleted = await this.projectRepository.deleteParticipant(participantId, organizationId);
    if (!deleted) {
      throw new ServiceError('Participant not found', 'PARTICIPANT_NOT_FOUND', 404);
    }
  }

  // ========== Private Helpers ==========

  private mapProjectToDto(row: any): Project {
    return {
      id: row.id,
      organizationId: row.organizationId,
      subsidiaryId: row.subsidiaryId,
      customerId: row.customerId,
      customerName: row.customerName ?? null,
      projectCode: row.projectCode,
      name: row.name,
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      jobNumber: row.jobNumber,
      projectType: row.projectType,
      budgetRevenue: row.budgetRevenue,
      budgetCost: row.budgetCost,
      percentComplete: row.percentComplete ?? null,
      retainagePercent: row.retainagePercent,
      currencyCode: row.currencyCode,
      description: row.description,
      externalSource: row.externalSource,
      metadata: row.metadata,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    };
  }

  private mapParticipantToDto(row: any): ProjectParticipant {
    return {
      id: row.id,
      projectId: row.projectId,
      entityId: row.entityId,
      participantRole: row.participantRole,
      isPrimary: row.isPrimary,
      metadata: row.metadata,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    };
  }
}
