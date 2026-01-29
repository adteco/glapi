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

export class ProspectService extends EntityService {

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
   * List all prospects
   */
  async listProspects(query: EntityListQuery): Promise<EntityListResponse> {
    return this.list(['Prospect'], query);
  }

  /**
   * Create a new prospect
   */
  async createProspect(
    data: CreateEntityInput & { metadata?: LeadProspectMetadata }
  ): Promise<BaseEntity> {
    return this.create(['Prospect'], data);
  }

  /**
   * Update a prospect
   */
  async updateProspect(
    id: string,
    data: UpdateEntityInput & { metadata?: LeadProspectMetadata }
  ): Promise<BaseEntity> {
    return this.update(id, data);
  }

  /**
   * Convert prospect to lead
   */
  async convertToLead(prospectId: string): Promise<BaseEntity> {
    const prospect = await this.findById(prospectId);
    if (!prospect) {
      throw new Error('Prospect not found');
    }

    // Remove Prospect type and add Lead type
    await this.removeEntityType(prospectId, 'Prospect');
    await this.addEntityType(prospectId, 'Lead');

    // Update metadata with conversion info
    const metadata = {
      ...(prospect.metadata || {}),
      convertedDate: new Date().toISOString(),
      originalType: 'Prospect',
    };

    return this.update(prospectId, { metadata });
  }

  /**
   * Convert prospect to customer
   */
  async convertToCustomer(prospectId: string): Promise<BaseEntity> {
    const prospect = await this.findById(prospectId);
    if (!prospect) {
      throw new Error('Prospect not found');
    }

    // Remove Prospect type and add Customer type
    await this.removeEntityType(prospectId, 'Prospect');
    await this.addEntityType(prospectId, 'Customer');

    // Update metadata with conversion info
    const metadata = {
      ...(prospect.metadata || {}),
      convertedDate: new Date().toISOString(),
      originalType: 'Prospect',
    };

    return this.update(prospectId, { metadata });
  }

  /**
   * Find prospects by industry
   */
  async findByIndustry(industry: string): Promise<BaseEntity[]> {
    const organizationId = this.requireOrganizationContext();
    const prospects = await this.repository.findByTypes(
      ['Prospect'],
      organizationId,
      {
        limit: 1000,
      }
    );

    // Filter by industry in metadata
    const filtered = prospects.filter(p =>
      (p.metadata as LeadProspectMetadata)?.industry === industry
    );
    return this.transformEntities(filtered);
  }

  /**
   * Find high-value prospects
   */
  async findHighValueProspects(minRevenue: number = 1000000): Promise<BaseEntity[]> {
    const organizationId = this.requireOrganizationContext();
    const rawProspects = await this.repository.findByTypes(
      ['Prospect'],
      organizationId,
      {
        limit: 1000,
      }
    );

    const prospects = this.transformEntities(rawProspects);

    // Filter by annual revenue in metadata
    return prospects
      .filter(p => {
        const revenue = (p.metadata as LeadProspectMetadata)?.annualRevenue || 0;
        return revenue >= minRevenue;
      })
      .sort((a, b) => {
        const revenueA = (a.metadata as LeadProspectMetadata)?.annualRevenue || 0;
        const revenueB = (b.metadata as LeadProspectMetadata)?.annualRevenue || 0;
        return revenueB - revenueA;
      });
  }
}

// Note: Prefer creating new instances with serviceContext rather than using singleton
export const prospectService = new ProspectService();