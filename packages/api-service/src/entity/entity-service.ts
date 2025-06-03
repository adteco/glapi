import { entityRepository } from '@repo/database';
import { 
  EntityType, 
  CreateEntityInput, 
  UpdateEntityInput, 
  EntityListQuery,
  EntityListResponse,
  BaseEntity
} from './types';

export class EntityService {
  protected repository = entityRepository;
  
  /**
   * Find entity by ID
   */
  async findById(id: string, organizationId: string): Promise<BaseEntity | null> {
    const entity = await this.repository.findById(id, organizationId);
    return entity as BaseEntity | null;
  }
  
  /**
   * Find entity by code
   */
  async findByCode(code: string, organizationId: string): Promise<BaseEntity | null> {
    const entity = await this.repository.findByCode(code, organizationId);
    return entity as BaseEntity | null;
  }
  
  /**
   * List entities by type with pagination
   */
  async list(
    organizationId: string,
    entityTypes: EntityType[],
    query: EntityListQuery
  ): Promise<EntityListResponse> {
    const { page, limit, orderBy, orderDirection, status, search, parentEntityId, isActive } = query;
    
    const offset = (page - 1) * limit;
    
    const entities = await this.repository.findByTypes(
      entityTypes,
      organizationId,
      {
        status,
        searchTerm: search,
        parentEntityId,
        isActive,
        limit,
        offset,
        orderBy,
        orderDirection,
      }
    );
    
    const total = await this.repository.countByTypes(
      entityTypes,
      organizationId,
      {
        status,
        searchTerm: search,
        parentEntityId,
        isActive,
      }
    );
    
    return {
      data: entities as BaseEntity[],
      total: Number(total),
      page,
      limit,
      totalPages: Math.ceil(Number(total) / limit),
    };
  }
  
  /**
   * Create a new entity
   */
  async create(
    organizationId: string,
    entityTypes: EntityType[],
    data: CreateEntityInput
  ): Promise<BaseEntity> {
    const entity = await this.repository.create({
      ...data,
      organizationId,
      entityTypes,
    });
    
    return entity as BaseEntity;
  }
  
  /**
   * Update an entity
   */
  async update(
    id: string,
    organizationId: string,
    data: UpdateEntityInput
  ): Promise<BaseEntity> {
    const entity = await this.repository.update(id, organizationId, data);
    
    if (!entity) {
      throw new Error('Entity not found');
    }
    
    return entity as BaseEntity;
  }
  
  /**
   * Delete an entity
   */
  async delete(id: string, organizationId: string): Promise<void> {
    await this.repository.delete(id, organizationId);
  }
  
  /**
   * Add an entity type to an existing entity
   */
  async addEntityType(
    id: string,
    organizationId: string,
    entityType: EntityType
  ): Promise<BaseEntity> {
    const entity = await this.repository.addEntityType(id, organizationId, entityType);
    return entity as BaseEntity;
  }
  
  /**
   * Remove an entity type from an existing entity
   */
  async removeEntityType(
    id: string,
    organizationId: string,
    entityType: EntityType
  ): Promise<BaseEntity> {
    const entity = await this.repository.removeEntityType(id, organizationId, entityType);
    return entity as BaseEntity;
  }
  
  /**
   * Find contacts for a parent entity
   */
  async findContactsForEntity(
    entityId: string,
    organizationId: string
  ): Promise<BaseEntity[]> {
    const contacts = await this.repository.findContactsForEntity(entityId, organizationId);
    return contacts as BaseEntity[];
  }
}

export const entityService = new EntityService();