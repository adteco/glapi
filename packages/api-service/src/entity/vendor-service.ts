import { EntityService, EntityServiceOptions } from './entity-service';
import {
  CreateEntityInput,
  UpdateEntityInput,
  EntityListQuery,
  EntityListResponse,
  BaseEntity,
  VendorMetadata
} from './types';
import { ServiceContext } from '../types';

export class VendorService extends EntityService {

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
   * List all vendors
   */
  async listVendors(query: EntityListQuery): Promise<EntityListResponse> {
    return this.list(['Vendor'], query);
  }

  /**
   * Create a new vendor
   */
  async createVendor(
    data: CreateEntityInput & { metadata?: VendorMetadata }
  ): Promise<BaseEntity> {
    return this.create(['Vendor'], data);
  }

  /**
   * Update a vendor
   */
  async updateVendor(
    id: string,
    data: UpdateEntityInput & { metadata?: VendorMetadata }
  ): Promise<BaseEntity> {
    return this.update(id, data);
  }

  /**
   * Find vendor by EIN
   */
  async findByEIN(ein: string): Promise<BaseEntity | null> {
    const organizationId = this.requireOrganizationContext();
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

    return vendor ? this.transformEntity(vendor) : null;
  }
}

// DEPRECATED: Prefer creating new instances with serviceContext and db for RLS support
// This singleton does NOT have RLS context set
export const vendorService = new VendorService();