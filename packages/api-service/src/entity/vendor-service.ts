import { EntityService } from './entity-service';
import { 
  CreateEntityInput, 
  UpdateEntityInput, 
  EntityListQuery,
  EntityListResponse,
  BaseEntity,
  VendorMetadata
} from './types';

export class VendorService extends EntityService {
  /**
   * List all vendors
   */
  async listVendors(
    organizationId: string,
    query: EntityListQuery
  ): Promise<EntityListResponse> {
    return this.list(organizationId, ['Vendor'], query);
  }
  
  /**
   * Create a new vendor
   */
  async createVendor(
    organizationId: string,
    data: CreateEntityInput & { metadata?: VendorMetadata }
  ): Promise<BaseEntity> {
    return this.create(organizationId, ['Vendor'], data);
  }
  
  /**
   * Update a vendor
   */
  async updateVendor(
    id: string,
    organizationId: string,
    data: UpdateEntityInput & { metadata?: VendorMetadata }
  ): Promise<BaseEntity> {
    return this.update(id, organizationId, data);
  }
  
  /**
   * Find vendor by EIN
   */
  async findByEIN(ein: string, organizationId: string): Promise<BaseEntity | null> {
    const vendors = await this.repository.findByTypes(
      ['Vendor'],
      organizationId,
      {
        searchTerm: ein,
        limit: 100,
      }
    );
    
    // Filter by EIN in metadata
    const vendor = vendors.find(v => 
      (v.metadata as VendorMetadata)?.ein === ein
    );
    
    return vendor as BaseEntity || null;
  }
}

export const vendorService = new VendorService();