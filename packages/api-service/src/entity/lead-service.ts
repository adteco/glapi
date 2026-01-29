import { EntityService, EntityServiceOptions } from './entity-service';
import {
  CreateEntityInput,
  UpdateEntityInput,
  EntityListQuery,
  EntityListResponse,
  BaseEntity,
  LeadProspectMetadata
} from './types';
import { ServiceContext } from '../types';

export class LeadService extends EntityService {

  constructor(context: ServiceContext = {}, options: EntityServiceOptions = {}) {
    super(context, options);
  }

  /**
   * Transform database entity to match expected types
   */
  protected transformEntity(entity: any): BaseEntity {
    if (!entity) return entity;
    return {
      ...entity,
      createdAt: entity.createdAt instanceof Date ? entity.createdAt.toISOString() : entity.createdAt,
      updatedAt: entity.updatedAt instanceof Date ? entity.updatedAt.toISOString() : entity.updatedAt,
    };
  }

  /**
   * Transform array of database entities
   */
  protected transformEntities(entities: any[]): BaseEntity[] {
    return entities.map(entity => this.transformEntity(entity));
  }

  /**
   * List all leads
   */
  async listLeads(query: EntityListQuery): Promise<EntityListResponse> {
    return this.list(['Lead'], query);
  }

  /**
   * Create a new lead
   */
  async createLead(
    data: CreateEntityInput & { metadata?: LeadProspectMetadata }
  ): Promise<BaseEntity> {
    return this.create(['Lead'], data);
  }

  /**
   * Update a lead
   */
  async updateLead(
    id: string,
    data: UpdateEntityInput & { metadata?: LeadProspectMetadata }
  ): Promise<BaseEntity> {
    return this.update(id, data);
  }

  /**
   * Convert lead to customer
   */
  async convertToCustomer(leadId: string): Promise<BaseEntity> {
    const lead = await this.findById(leadId);
    if (!lead) {
      throw new Error('Lead not found');
    }

    // Remove Lead type and add Customer type
    await this.removeEntityType(leadId, 'Lead');
    await this.addEntityType(leadId, 'Customer');

    // Update metadata with conversion info
    const metadata = {
      ...(lead.metadata || {}),
      convertedDate: new Date().toISOString(),
      originalType: 'Lead',
    };

    return this.update(leadId, { metadata });
  }

  /**
   * Find leads by source
   */
  async findBySource(source: string): Promise<BaseEntity[]> {
    const organizationId = this.requireOrganizationContext();
    const leads = await this.repository.findByTypes(
      ['Lead'],
      organizationId,
      {
        limit: 1000,
      }
    );

    // Filter by source in metadata
    const filtered = leads.filter(l =>
      (l.metadata as LeadProspectMetadata)?.source === source
    );
    return this.transformEntities(filtered);
  }

  /**
   * Find leads assigned to a user
   */
  async findByAssignee(assigneeId: string): Promise<BaseEntity[]> {
    const organizationId = this.requireOrganizationContext();
    const leads = await this.repository.findByTypes(
      ['Lead'],
      organizationId,
      {
        limit: 1000,
      }
    );

    // Filter by assignedTo in metadata
    const filtered = leads.filter(l =>
      (l.metadata as LeadProspectMetadata)?.assignedTo === assigneeId
    );
    return this.transformEntities(filtered);
  }

  /**
   * Get lead scoring statistics
   */
  async getLeadScoreStats(): Promise<{
    averageScore: number;
    highScoringLeads: BaseEntity[];
    totalLeads: number;
  }> {
    const organizationId = this.requireOrganizationContext();
    const rawLeads = await this.repository.findByTypes(
      ['Lead'],
      organizationId,
      {
        limit: 1000,
      }
    );

    const leads = this.transformEntities(rawLeads);

    const scores = leads
      .map(l => (l.metadata as LeadProspectMetadata)?.leadScore || 0)
      .filter(score => score > 0);

    const averageScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    const highScoringLeads = leads
      .filter(l => {
        const score = (l.metadata as LeadProspectMetadata)?.leadScore || 0;
        return score >= 70; // Consider 70+ as high scoring
      })
      .sort((a, b) => {
        const scoreA = (a.metadata as LeadProspectMetadata)?.leadScore || 0;
        const scoreB = (b.metadata as LeadProspectMetadata)?.leadScore || 0;
        return scoreB - scoreA;
      });

    return {
      averageScore,
      highScoringLeads,
      totalLeads: leads.length,
    };
  }
}

// Note: Prefer creating new instances with serviceContext rather than using singleton
export const leadService = new LeadService();