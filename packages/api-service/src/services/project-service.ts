import { BaseService } from './base-service';
import { PaginatedResult, PaginationParams, ServiceError } from '../types';
import {
  Project,
  ProjectFilters,
  ProjectWithRelations,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectParticipant,
  ProjectParticipantInput,
  ProjectAddress,
  ProjectAddressInput,
} from '../types/projects.types';
import {
  ProjectRepository,
  ProjectAccessError,
  ProjectPaginationParams,
} from '@glapi/database';

interface ProjectListParams extends PaginationParams {
  orderBy?: ProjectPaginationParams['orderBy'];
  orderDirection?: ProjectPaginationParams['orderDirection'];
}

export class ProjectService extends BaseService {
  private projectRepository: ProjectRepository;

  constructor(context = {}) {
    super(context);
    this.projectRepository = new ProjectRepository();
  }

  private transformProject(dbProject: any): Project {
    return {
      id: dbProject.id,
      organizationId: dbProject.organizationId,
      subsidiaryId: dbProject.subsidiaryId,
      projectCode: dbProject.projectCode,
      name: dbProject.name,
      status: dbProject.status,
      startDate: dbProject.startDate,
      endDate: dbProject.endDate,
      externalSource: dbProject.externalSource,
      jobNumber: dbProject.jobNumber,
      projectType: dbProject.projectType,
      retainagePercent: dbProject.retainagePercent ?? '0',
      currencyCode: dbProject.currencyCode,
      description: dbProject.description,
      metadata: dbProject.metadata,
      createdAt: dbProject.createdAt,
      updatedAt: dbProject.updatedAt,
    };
  }

  private transformParticipant(row: any): ProjectParticipant {
    return {
      id: row.id,
      projectId: row.projectId,
      entityId: row.entityId,
      participantRole: row.participantRole,
      isPrimary: row.isPrimary,
      metadata: row.metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      entityName: row.entityName ?? null,
      entityType: row.entityType ?? null,
      entityExternalId: row.entityExternalId ?? null,
    };
  }

  private transformAddress(row: any): ProjectAddress {
    return {
      id: row.id,
      projectId: row.projectId,
      addressType: row.addressType,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      city: row.city,
      state: row.state,
      postalCode: row.postalCode,
      country: row.country,
      metadata: row.metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private handleAccessError(error: unknown): never {
    if (error instanceof ProjectAccessError) {
      throw new ServiceError('Access denied to this project', 'PROJECT_ACCESS_DENIED', 403);
    }
    throw error;
  }

  async listProjects(
    params: ProjectListParams = {},
    filters: ProjectFilters = {}
  ): Promise<PaginatedResult<Project>> {
    const organizationId = this.requireOrganizationContext();
    const result = await this.projectRepository.findAll(
      organizationId,
      {
        page: params.page,
        limit: params.limit,
        orderBy: params.orderBy,
        orderDirection: params.orderDirection,
      },
      filters
    );

    return {
      ...result,
      data: result.data.map((project) => this.transformProject(project)),
    };
  }

  async getProjectById(id: string): Promise<ProjectWithRelations> {
    const organizationId = this.requireOrganizationContext();
    const project = await this.projectRepository.findById(id, organizationId);

    if (!project) {
      throw new ServiceError('Project not found', 'PROJECT_NOT_FOUND', 404);
    }

    const [participants, addresses] = await Promise.all([
      this.projectRepository.listParticipants(id, organizationId),
      this.projectRepository.listAddresses(id, organizationId),
    ]);

    return {
      ...this.transformProject(project),
      participants: participants.map((p) => this.transformParticipant(p)),
      addresses: addresses.map((addr) => this.transformAddress(addr)),
    };
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const organizationId = this.requireOrganizationContext();

    const exists = await this.projectRepository.existsByCode(organizationId, input.projectCode);
    if (exists) {
      throw new ServiceError('Project code already exists', 'PROJECT_CODE_EXISTS', 400);
    }

    const created = await this.projectRepository.create({
      organizationId,
      projectCode: input.projectCode,
      name: input.name,
      status: input.status,
      subsidiaryId: input.subsidiaryId,
      startDate: input.startDate,
      endDate: input.endDate,
      externalSource: input.externalSource,
      jobNumber: input.jobNumber,
      projectType: input.projectType,
      retainagePercent: input.retainagePercent,
      currencyCode: input.currencyCode,
      description: input.description,
      metadata: input.metadata,
    });

    return this.transformProject(created);
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
    const organizationId = this.requireOrganizationContext();
    const existing = await this.projectRepository.findById(id, organizationId);

    if (!existing) {
      throw new ServiceError('Project not found', 'PROJECT_NOT_FOUND', 404);
    }

    if (input.projectCode && input.projectCode !== existing.projectCode) {
      const duplicate = await this.projectRepository.existsByCode(organizationId, input.projectCode, id);
      if (duplicate) {
        throw new ServiceError('Project code already exists', 'PROJECT_CODE_EXISTS', 400);
      }
    }

    const updated = await this.projectRepository.update(id, organizationId, input);

    if (!updated) {
      throw new ServiceError('Failed to update project', 'PROJECT_UPDATE_FAILED', 500);
    }

    return this.transformProject(updated);
  }

  async deleteProject(id: string): Promise<{ success: boolean }> {
    const organizationId = this.requireOrganizationContext();
    const existing = await this.projectRepository.findById(id, organizationId);

    if (!existing) {
      throw new ServiceError('Project not found', 'PROJECT_NOT_FOUND', 404);
    }

    await this.projectRepository.delete(id, organizationId);
    return { success: true };
  }

  async listParticipants(projectId: string): Promise<ProjectParticipant[]> {
    const organizationId = this.requireOrganizationContext();
    const project = await this.projectRepository.findById(projectId, organizationId);

    if (!project) {
      throw new ServiceError('Project not found', 'PROJECT_NOT_FOUND', 404);
    }

    const participants = await this.projectRepository.listParticipants(projectId, organizationId);
    return participants.map((p) => this.transformParticipant(p));
  }

  async upsertParticipant(projectId: string, input: ProjectParticipantInput): Promise<ProjectParticipant> {
    const organizationId = this.requireOrganizationContext();

    try {
      const participant = await this.projectRepository.upsertParticipant(projectId, organizationId, {
        entityId: input.entityId ?? null,
        participantRole: input.participantRole,
        isPrimary: input.isPrimary,
        metadata: input.metadata,
      });
      return this.transformParticipant(participant);
    } catch (error) {
      this.handleAccessError(error);
    }
  }

  async removeParticipant(participantId: string): Promise<{ success: boolean }> {
    const organizationId = this.requireOrganizationContext();
    const removed = await this.projectRepository.removeParticipant(participantId, organizationId);

    if (!removed) {
      throw new ServiceError('Participant not found', 'PROJECT_PARTICIPANT_NOT_FOUND', 404);
    }

    return { success: true };
  }

  async listAddresses(projectId: string): Promise<ProjectAddress[]> {
    const organizationId = this.requireOrganizationContext();
    const project = await this.projectRepository.findById(projectId, organizationId);

    if (!project) {
      throw new ServiceError('Project not found', 'PROJECT_NOT_FOUND', 404);
    }

    const addresses = await this.projectRepository.listAddresses(projectId, organizationId);
    return addresses.map((addr) => this.transformAddress(addr));
  }

  async upsertAddress(projectId: string, input: ProjectAddressInput): Promise<ProjectAddress> {
    const organizationId = this.requireOrganizationContext();

    try {
      const address = await this.projectRepository.upsertAddress(projectId, organizationId, {
        addressType: input.addressType,
        addressLine1: input.addressLine1 ?? null,
        addressLine2: input.addressLine2 ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        postalCode: input.postalCode ?? null,
        country: input.country ?? null,
        metadata: input.metadata ?? null,
      });
      return this.transformAddress(address);
    } catch (error) {
      this.handleAccessError(error);
    }
  }

  async deleteAddress(addressId: string): Promise<{ success: boolean }> {
    const organizationId = this.requireOrganizationContext();
    const deleted = await this.projectRepository.deleteAddress(addressId, organizationId);

    if (!deleted) {
      throw new ServiceError('Address not found', 'PROJECT_ADDRESS_NOT_FOUND', 404);
    }

    return { success: true };
  }
}
