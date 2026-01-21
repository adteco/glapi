import { BaseService } from './base-service';
import { ServiceContext, ServiceError, PaginatedResult } from '../types';
import {
  ChangeRequestRepository,
  type ChangeRequestRecord,
  type NewChangeRequestRecord,
  changeRequestStatusEnum,
} from '@glapi/database';

export interface CreateChangeRequestInput {
  title: string;
  description?: string;
  requestType?: string;
  subsystem?: string;
  riskLevel?: string;
  linkedResourceType?: string;
  linkedResourceId?: string;
  changeWindowStart?: Date | string;
  changeWindowEnd?: Date | string;
  metadata?: Record<string, unknown>;
}

export interface ChangeRequestFilters {
  status?: (typeof changeRequestStatusEnum.enumValues)[number];
  requestType?: string;
  subsystem?: string;
  page?: number;
  limit?: number;
}

export class ChangeManagementService extends BaseService {
  private repository: ChangeRequestRepository;

  constructor(context: ServiceContext = {}) {
    super(context);
    this.repository = new ChangeRequestRepository();
  }

  async createChangeRequest(input: CreateChangeRequestInput): Promise<ChangeRequestRecord> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();

    const payload: NewChangeRequestRecord = {
      organizationId,
      title: input.title,
      description: input.description,
      requestType: input.requestType,
      subsystem: input.subsystem,
      riskLevel: input.riskLevel,
      status: 'draft',
      linkedResourceType: input.linkedResourceType,
      linkedResourceId: input.linkedResourceId,
      changeWindowStart: input.changeWindowStart
        ? new Date(input.changeWindowStart)
        : undefined,
      changeWindowEnd: input.changeWindowEnd ? new Date(input.changeWindowEnd) : undefined,
      metadata: input.metadata,
      createdBy: userId,
      updatedBy: userId,
    };

    return this.repository.create(payload);
  }

  async listChangeRequests(filters: ChangeRequestFilters = {}): Promise<
    PaginatedResult<ChangeRequestRecord>
  > {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams({
      page: filters.page,
      limit: filters.limit,
    });

    const records = await this.repository.listByOrganization(organizationId, filters.status);
    const filtered = records.filter((record) => {
      if (filters.requestType && record.requestType !== filters.requestType) {
        return false;
      }
      if (filters.subsystem && record.subsystem !== filters.subsystem) {
        return false;
      }
      return true;
    });

    const paged = filtered.slice(skip, skip + take);
    return this.createPaginatedResult(paged, filtered.length, page, limit);
  }

  async getChangeRequest(id: string): Promise<ChangeRequestRecord | null> {
    const organizationId = this.requireOrganizationContext();
    const record = await this.repository.findById(id);
    if (!record || record.organizationId !== organizationId) {
      return null;
    }
    return record;
  }

  async submitChangeRequest(id: string): Promise<ChangeRequestRecord> {
    const request = await this.requireAccessibleRequest(id);
    if (request.status !== 'draft') {
      throw new ServiceError('Only draft change requests can be submitted', 'INVALID_STATE', 400);
    }

    const userId = this.requireUserContext();
    return this.repository.update(id, {
      status: 'pending_approval',
      submittedAt: new Date(),
      updatedBy: userId,
    }) as Promise<ChangeRequestRecord>;
  }

  async approveChangeRequest(id: string): Promise<ChangeRequestRecord> {
    const request = await this.requireAccessibleRequest(id);
    if (request.status !== 'pending_approval') {
      throw new ServiceError('Only pending requests can be approved', 'INVALID_STATE', 400);
    }

    const userId = this.requireUserContext();
    return this.repository.update(id, {
      status: 'approved',
      approvedAt: new Date(),
      updatedBy: userId,
    }) as Promise<ChangeRequestRecord>;
  }

  async rejectChangeRequest(id: string): Promise<ChangeRequestRecord> {
    const request = await this.requireAccessibleRequest(id);
    if (request.status !== 'pending_approval') {
      throw new ServiceError('Only pending requests can be rejected', 'INVALID_STATE', 400);
    }

    const userId = this.requireUserContext();
    return this.repository.update(id, {
      status: 'rejected',
      updatedBy: userId,
    }) as Promise<ChangeRequestRecord>;
  }

  async completeChangeRequest(id: string): Promise<ChangeRequestRecord> {
    const request = await this.requireAccessibleRequest(id);
    if (!['approved', 'pending_approval'].includes(request.status)) {
      throw new ServiceError(
        'Only approved or pending requests can be marked as completed',
        'INVALID_STATE',
        400,
      );
    }

    const userId = this.requireUserContext();
    return this.repository.update(id, {
      status: 'completed',
      completedAt: new Date(),
      updatedBy: userId,
    }) as Promise<ChangeRequestRecord>;
  }

  private async requireAccessibleRequest(id: string): Promise<ChangeRequestRecord> {
    const organizationId = this.requireOrganizationContext();
    const record = await this.repository.findById(id);
    if (!record || record.organizationId !== organizationId) {
      throw new ServiceError('Change request not found', 'NOT_FOUND', 404);
    }
    return record;
  }
}
