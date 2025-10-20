import { entityRepository } from '@glapi/database';
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
   * Find entity by ID
   */
  async findById(id: string, organizationId: string): Promise<BaseEntity | null> {
    const entity = await this.repository.findById(id, organizationId);
    return this.transformEntity(entity);
  }
  
  /**
   * Find entity by code
   */
  async findByCode(code: string, organizationId: string): Promise<BaseEntity | null> {
    const entity = await this.repository.findByCode(code, organizationId);
    return this.transformEntity(entity);
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
      data: this.transformEntities(entities),
      total: Number(total),
      page,
      limit,
      totalPages: Math.ceil(Number(total) / limit),
    };
  }
  
  /**
   * Transform null values to undefined for repository compatibility
   */
  private cleanData<T extends Record<string, any>>(data: T): any {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      cleaned[key] = value === null ? undefined : value;
    }
    return cleaned;
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
      ...this.cleanData(data),
      organizationId,
      entityTypes,
    } as any);

    return this.transformEntity(entity);
  }

  /**
   * Update an entity
   */
  async update(
    id: string,
    organizationId: string,
    data: UpdateEntityInput
  ): Promise<BaseEntity> {
    const entity = await this.repository.update(id, organizationId, this.cleanData(data) as any);

    if (!entity) {
      throw new Error('Entity not found');
    }

    return this.transformEntity(entity);
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
    return this.transformEntity(entity);
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
    return this.transformEntity(entity);
  }
  
  /**
   * Find contacts for a parent entity
   */
  async findContactsForEntity(
    entityId: string,
    organizationId: string
  ): Promise<BaseEntity[]> {
    const contacts = await this.repository.findContactsForEntity(entityId, organizationId);
    return this.transformEntities(contacts);
  }
}

export const entityService = new EntityService();