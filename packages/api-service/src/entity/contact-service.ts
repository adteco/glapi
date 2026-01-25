import { EntityService } from './entity-service';
import {
  CreateEntityInput,
  UpdateEntityInput,
  EntityListQuery,
  EntityListResponse,
  BaseEntity,
  ContactMetadata
} from './types';
import { ServiceContext } from '../types';

export class ContactService extends EntityService {

  constructor(context: ServiceContext = {}) {
    super(context);
  }

  /**
   * Transform database entity to match expected types
   */
  protected transformEntity(entity: any): BaseEntity {
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
   * List all contacts
   */
  async listContacts(query: EntityListQuery): Promise<EntityListResponse> {
    return this.list(['Contact'], query);
  }

  /**
   * Create a new contact
   */
  async createContact(
    data: CreateEntityInput & { metadata?: ContactMetadata }
  ): Promise<BaseEntity> {
    // Ensure contact has a parent entity if not standalone
    if (!data.parentEntityId && !data.metadata?.title) {
      throw new Error('Contact must be associated with a parent entity or have a title');
    }

    return this.create(['Contact'], data);
  }

  /**
   * Update a contact
   */
  async updateContact(
    id: string,
    data: UpdateEntityInput & { metadata?: ContactMetadata }
  ): Promise<BaseEntity> {
    return this.update(id, data);
  }

  /**
   * Find contacts for a specific company/entity
   */
  async findByCompany(companyId: string): Promise<BaseEntity[]> {
    return this.findContactsForEntity(companyId);
  }

  /**
   * Find contacts by department
   */
  async findByDepartment(department: string): Promise<BaseEntity[]> {
    const organizationId = this.requireOrganizationContext();
    const contacts = await this.repository.findByTypes(
      ['Contact'],
      organizationId,
      {
        limit: 1000,
      }
    );

    // Filter by department in metadata
    const filtered = contacts.filter(c =>
      (c.metadata as ContactMetadata)?.department === department
    );
    return this.transformEntities(filtered);
  }

  /**
   * Set as primary contact for a company
   */
  async setAsPrimaryContact(
    contactId: string,
    companyId: string
  ): Promise<{ contact: BaseEntity; company: BaseEntity }> {
    const organizationId = this.requireOrganizationContext();
    // Verify contact exists and belongs to the company
    const contact = await this.findById(contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }

    if (contact.parentEntityId !== companyId) {
      throw new Error('Contact does not belong to the specified company');
    }

    // Update the company to set this contact as primary
    const company = await this.repository.update(companyId, organizationId, {
      primaryContactId: contactId,
    });

    if (!company) {
      throw new Error('Company not found');
    }

    return {
      contact: this.transformEntity(contact),
      company: this.transformEntity(company),
    };
  }

  /**
   * Find contacts by preferred contact method
   */
  async findByContactMethod(
    method: 'email' | 'phone' | 'mobile'
  ): Promise<BaseEntity[]> {
    const organizationId = this.requireOrganizationContext();
    const contacts = await this.repository.findByTypes(
      ['Contact'],
      organizationId,
      {
        limit: 1000,
      }
    );

    // Filter by preferred contact method in metadata
    const filtered = contacts.filter(c =>
      (c.metadata as ContactMetadata)?.preferredContactMethod === method
    );
    return this.transformEntities(filtered);
  }

  /**
   * Get contact hierarchy (who reports to whom)
   */
  async getContactHierarchy(): Promise<Map<string, BaseEntity[]>> {
    const organizationId = this.requireOrganizationContext();
    const contacts = await this.repository.findByTypes(
      ['Contact'],
      organizationId,
      {
        limit: 1000,
      }
    );

    // Build hierarchy map
    const hierarchy = new Map<string, BaseEntity[]>();

    contacts.forEach(contact => {
      const reportsTo = (contact.metadata as ContactMetadata)?.reportsTo;
      if (reportsTo) {
        const reports = hierarchy.get(reportsTo) || [];
        reports.push(this.transformEntity(contact));
        hierarchy.set(reportsTo, reports);
      }
    });

    return hierarchy;
  }
}

// Note: Prefer creating new instances with serviceContext rather than using singleton
export const contactService = new ContactService();