import { EntityService } from './entity-service';
import { 
  CreateEntityInput, 
  UpdateEntityInput, 
  EntityListQuery,
  EntityListResponse,
  BaseEntity,
  LeadProspectMetadata
} from './types';

export class LeadService extends EntityService {
  /**
   * List all leads
   */
  async listLeads(
    organizationId: string,
    query: EntityListQuery
  ): Promise<EntityListResponse> {
    return this.list(organizationId, ['Lead'], query);
  }
  
  /**
   * Create a new lead
   */
  async createLead(
    organizationId: string,
    data: CreateEntityInput & { metadata?: LeadProspectMetadata }
  ): Promise<BaseEntity> {
    return this.create(organizationId, ['Lead'], data);
  }
  
  /**
   * Update a lead
   */
  async updateLead(
    id: string,
    organizationId: string,
    data: UpdateEntityInput & { metadata?: LeadProspectMetadata }
  ): Promise<BaseEntity> {
    return this.update(id, organizationId, data);
  }
  
  /**
   * Convert lead to customer
   */
  async convertToCustomer(
    leadId: string,
    organizationId: string
  ): Promise<BaseEntity> {
    const lead = await this.findById(leadId, organizationId);
    if (!lead) {
      throw new Error('Lead not found');
    }
    
    // Remove Lead type and add Customer type
    await this.removeEntityType(leadId, organizationId, 'Lead');
    const customer = await this.addEntityType(leadId, organizationId, 'Customer');
    
    // Update metadata with conversion info
    const metadata = {
      ...(lead.metadata || {}),
      convertedDate: new Date().toISOString(),
      originalType: 'Lead',
    };
    
    return this.update(leadId, organizationId, { metadata });
  }
  
  /**
   * Find leads by source
   */
  async findBySource(
    source: string,
    organizationId: string
  ): Promise<BaseEntity[]> {
    const leads = await this.repository.findByTypes(
      ['Lead'],
      organizationId,
      {
        limit: 1000,
      }
    );
    
    // Filter by source in metadata
    return leads.filter(l => 
      (l.metadata as LeadProspectMetadata)?.source === source
    ) as BaseEntity[];
  }
  
  /**
   * Find leads assigned to a user
   */
  async findByAssignee(
    assigneeId: string,
    organizationId: string
  ): Promise<BaseEntity[]> {
    const leads = await this.repository.findByTypes(
      ['Lead'],
      organizationId,
      {
        limit: 1000,
      }
    );
    
    // Filter by assignedTo in metadata
    return leads.filter(l => 
      (l.metadata as LeadProspectMetadata)?.assignedTo === assigneeId
    ) as BaseEntity[];
  }
  
  /**
   * Get lead scoring statistics
   */
  async getLeadScoreStats(organizationId: string): Promise<{
    averageScore: number;
    highScoringLeads: BaseEntity[];
    totalLeads: number;
  }> {
    const leads = await this.repository.findByTypes(
      ['Lead'],
      organizationId,
      {
        limit: 1000,
      }
    );
    
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
      highScoringLeads: highScoringLeads as BaseEntity[],
      totalLeads: leads.length,
    };
  }
}

export const leadService = new LeadService();