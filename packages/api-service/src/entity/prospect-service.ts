import { EntityService } from './entity-service';
import { 
  CreateEntityInput, 
  UpdateEntityInput, 
  EntityListQuery,
  EntityListResponse,
  BaseEntity,
  LeadProspectMetadata
} from './types';

export class ProspectService extends EntityService {
  
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
  async listProspects(
    organizationId: string,
    query: EntityListQuery
  ): Promise<EntityListResponse> {
    return this.list(organizationId, ['Prospect'], query);
  }
  
  /**
   * Create a new prospect
   */
  async createProspect(
    organizationId: string,
    data: CreateEntityInput & { metadata?: LeadProspectMetadata }
  ): Promise<BaseEntity> {
    return this.create(organizationId, ['Prospect'], data);
  }
  
  /**
   * Update a prospect
   */
  async updateProspect(
    id: string,
    organizationId: string,
    data: UpdateEntityInput & { metadata?: LeadProspectMetadata }
  ): Promise<BaseEntity> {
    return this.update(id, organizationId, data);
  }
  
  /**
   * Convert prospect to lead
   */
  async convertToLead(
    prospectId: string,
    organizationId: string
  ): Promise<BaseEntity> {
    const prospect = await this.findById(prospectId, organizationId);
    if (!prospect) {
      throw new Error('Prospect not found');
    }
    
    // Remove Prospect type and add Lead type
    await this.removeEntityType(prospectId, organizationId, 'Prospect');
    const lead = await this.addEntityType(prospectId, organizationId, 'Lead');
    
    // Update metadata with conversion info
    const metadata = {
      ...(prospect.metadata || {}),
      convertedDate: new Date().toISOString(),
      originalType: 'Prospect',
    };
    
    return this.update(prospectId, organizationId, { metadata });
  }
  
  /**
   * Convert prospect to customer
   */
  async convertToCustomer(
    prospectId: string,
    organizationId: string
  ): Promise<BaseEntity> {
    const prospect = await this.findById(prospectId, organizationId);
    if (!prospect) {
      throw new Error('Prospect not found');
    }
    
    // Remove Prospect type and add Customer type
    await this.removeEntityType(prospectId, organizationId, 'Prospect');
    const customer = await this.addEntityType(prospectId, organizationId, 'Customer');
    
    // Update metadata with conversion info
    const metadata = {
      ...(prospect.metadata || {}),
      convertedDate: new Date().toISOString(),
      originalType: 'Prospect',
    };
    
    return this.update(prospectId, organizationId, { metadata });
  }
  
  /**
   * Find prospects by industry
   */
  async findByIndustry(
    industry: string,
    organizationId: string
  ): Promise<BaseEntity[]> {
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
  async findHighValueProspects(
    organizationId: string,
    minRevenue: number = 1000000
  ): Promise<BaseEntity[]> {
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

export const prospectService = new ProspectService();