import { BaseService } from './base-service';
import { 
  Organization, 
  CreateOrganizationInput, 
  ServiceError 
} from '../types';
import { OrganizationRepository } from '@glapi/database';

export class OrganizationService extends BaseService {
  private organizationRepository: OrganizationRepository;
  
  constructor(context = {}) {
    super(context);
    this.organizationRepository = new OrganizationRepository();
  }
  
  /**
   * Transform database organization to service layer type
   */
  private transformOrganization(dbOrganization: any): Organization {
    return {
      id: dbOrganization.id,
      stytchOrgId: dbOrganization.stytchOrgId,
      name: dbOrganization.name,
      slug: dbOrganization.slug,
      settings: dbOrganization.settings || undefined,
    };
  }
  
  /**
   * Get organization by Stytch organization ID
   */
  async getOrganizationByStytchId(stytchOrgId: string): Promise<Organization | null> {
    const organization = await this.organizationRepository.findByStytchId(stytchOrgId);
    return organization ? this.transformOrganization(organization) : null;
  }
  
  /**
   * Get organization by ID
   */
  async getOrganizationById(id: string): Promise<Organization | null> {
    const organization = await this.organizationRepository.findById(id);
    return organization ? this.transformOrganization(organization) : null;
  }
  
  /**
   * Create a new organization
   */
  async createOrganization(data: CreateOrganizationInput): Promise<Organization> {
    // Check if organization with this Stytch ID already exists
    const existing = await this.organizationRepository.findByStytchId(data.stytchOrgId);
    if (existing) {
      throw new ServiceError(
        `Organization with Stytch ID "${data.stytchOrgId}" already exists`,
        'DUPLICATE_ORGANIZATION',
        400
      );
    }
    
    // Check if slug is already in use
    const slugExists = await this.organizationRepository.findBySlug(data.slug);
    if (slugExists) {
      throw new ServiceError(
        `Organization with slug "${data.slug}" already exists`,
        'DUPLICATE_SLUG',
        400
      );
    }
    
    // Create the organization
    const organization = await this.organizationRepository.create(data);
    return this.transformOrganization(organization);
  }
  
  /**
   * Update an organization
   */
  async updateOrganization(id: string, data: Partial<Organization>): Promise<Organization> {
    // Verify organization exists
    const existing = await this.organizationRepository.findById(id);
    if (!existing) {
      throw new ServiceError(
        `Organization with ID "${id}" not found`,
        'ORGANIZATION_NOT_FOUND',
        404
      );
    }
    
    // If updating slug, check it's not already in use
    if (data.slug && data.slug !== existing.slug) {
      const slugExists = await this.organizationRepository.findBySlug(data.slug);
      if (slugExists) {
        throw new ServiceError(
          `Organization with slug "${data.slug}" already exists`,
          'DUPLICATE_SLUG',
          400
        );
      }
    }
    
    // Update the organization
    const result = await this.organizationRepository.update(id, data);
    
    if (!result) {
      throw new ServiceError(
        `Failed to update organization with ID "${id}"`,
        'UPDATE_FAILED',
        500
      );
    }
    
    return this.transformOrganization(result);
  }
  
  /**
   * Find or create organization from Stytch data
   */
  async findOrCreateOrganization(stytchOrgData: {
    organization_id: string;
    organization_name: string;
    organization_slug: string;
  }): Promise<Organization> {
    // Check if organization already exists
    const existing = await this.organizationRepository.findByStytchId(stytchOrgData.organization_id);
    if (existing) {
      return this.transformOrganization(existing);
    }
    
    // Create a new organization
    const newOrg: CreateOrganizationInput = {
      stytchOrgId: stytchOrgData.organization_id,
      name: stytchOrgData.organization_name,
      slug: stytchOrgData.organization_slug,
    };
    
    return this.createOrganization(newOrg);
  }
}