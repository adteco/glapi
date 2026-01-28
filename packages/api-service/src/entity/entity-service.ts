import { EntityRepository, type ContextualDatabase } from '@glapi/database';
import {
  EntityType,
  CreateEntityInput,
  UpdateEntityInput,
  EntityListQuery,
  EntityListResponse,
  BaseEntity
} from './types';
import { ServiceContext } from '../types';

export interface EntityServiceOptions {
  db?: ContextualDatabase;
}

export class EntityService {
  protected repository: EntityRepository;
  protected context: ServiceContext;

  constructor(context: ServiceContext = {}, options: EntityServiceOptions = {}) {
    this.context = context;
    // Pass the contextual db to the repository for RLS support
    this.repository = new EntityRepository(options.db);
  }

  /**
   * Validates that the current context has an organization ID
   * @throws {Error} If no organization ID is present
   */
  protected requireOrganizationContext(): string {
    if (!this.context.organizationId) {
      throw new Error('Organization context is required for this operation');
    }
    return this.context.organizationId;
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
   * Find entity by ID
   */
  async findById(id: string, organizationId?: string): Promise<BaseEntity | null> {
    const orgId = organizationId ?? this.requireOrganizationContext();
    const entity = await this.repository.findById(id, orgId);
    return this.transformEntity(entity);
  }

  /**
   * Find entity by code
   */
  async findByCode(code: string, organizationId?: string): Promise<BaseEntity | null> {
    const orgId = organizationId ?? this.requireOrganizationContext();
    const entity = await this.repository.findByCode(code, orgId);
    return this.transformEntity(entity);
  }

  /**
   * List entities by type with pagination
   */
  async list(
    entityTypes: EntityType[],
    query: EntityListQuery,
    organizationId?: string
  ): Promise<EntityListResponse> {
    const orgId = organizationId ?? this.requireOrganizationContext();
    const { page, limit, orderBy, orderDirection, status, search, parentEntityId, isActive } = query;

    const offset = (page - 1) * limit;

    const entities = await this.repository.findByTypes(
      entityTypes,
      orgId,
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
      orgId,
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
    entityTypes: EntityType[],
    data: CreateEntityInput,
    organizationId?: string
  ): Promise<BaseEntity> {
    const orgId = organizationId ?? this.requireOrganizationContext();
    const entity = await this.repository.create({
      ...this.cleanData(data),
      organizationId: orgId,
      entityTypes,
    } as any);

    return this.transformEntity(entity);
  }

  /**
   * Update an entity
   */
  async update(
    id: string,
    data: UpdateEntityInput,
    organizationId?: string
  ): Promise<BaseEntity> {
    const orgId = organizationId ?? this.requireOrganizationContext();
    const entity = await this.repository.update(id, orgId, this.cleanData(data) as any);

    if (!entity) {
      throw new Error('Entity not found');
    }

    return this.transformEntity(entity);
  }

  /**
   * Delete an entity
   */
  async delete(id: string, organizationId?: string): Promise<void> {
    const orgId = organizationId ?? this.requireOrganizationContext();
    await this.repository.delete(id, orgId);
  }

  /**
   * Add an entity type to an existing entity
   */
  async addEntityType(
    id: string,
    entityType: EntityType,
    organizationId?: string
  ): Promise<BaseEntity> {
    const orgId = organizationId ?? this.requireOrganizationContext();
    const entity = await this.repository.addEntityType(id, orgId, entityType);
    return this.transformEntity(entity);
  }

  /**
   * Remove an entity type from an existing entity
   */
  async removeEntityType(
    id: string,
    entityType: EntityType,
    organizationId?: string
  ): Promise<BaseEntity> {
    const orgId = organizationId ?? this.requireOrganizationContext();
    const entity = await this.repository.removeEntityType(id, orgId, entityType);
    return this.transformEntity(entity);
  }

  /**
   * Find contacts for a parent entity
   */
  async findContactsForEntity(
    entityId: string,
    organizationId?: string
  ): Promise<BaseEntity[]> {
    const orgId = organizationId ?? this.requireOrganizationContext();
    const contacts = await this.repository.findContactsForEntity(entityId, orgId);
    return this.transformEntities(contacts);
  }
}

// DEPRECATED: Prefer creating new instances with serviceContext and db for RLS support
// This singleton does NOT have RLS context set
export const entityService = new EntityService();