import { BaseService } from './base-service';
import {
  Organization,
  CreateOrganizationInput,
  ProvisionClerkOrganizationInput,
  ServiceError
} from '../types';
import { OrganizationRepository, SubsidiaryRepository } from '@glapi/database';

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

  /**
   * Provision a new organization from Clerk with a default subsidiary
   *
   * This is the primary method for onboarding new organizations that authenticate
   * via Clerk (including satellite domains like AdTeco).
   */
  async provisionFromClerk(input: ProvisionClerkOrganizationInput): Promise<{
    organization: Organization;
    subsidiary: { id: string; name: string; code: string };
  }> {
    const { clerkOrgId, name, slug, defaultSubsidiaryName } = input;

    // Check if organization with this Clerk ID already exists
    const existingByClerk = await this.organizationRepository.findByClerkId(clerkOrgId);
    if (existingByClerk) {
      throw new ServiceError(
        `Organization with Clerk ID "${clerkOrgId}" already exists`,
        'DUPLICATE_CLERK_ORGANIZATION',
        400
      );
    }

    // Generate slug if not provided
    const orgSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Check if slug is already in use
    const slugExists = await this.organizationRepository.findBySlug(orgSlug);
    if (slugExists) {
      throw new ServiceError(
        `Organization with slug "${orgSlug}" already exists`,
        'DUPLICATE_SLUG',
        400
      );
    }

    // Create the organization
    const organization = await this.organizationRepository.createFromClerk({
      clerkOrgId,
      name,
      slug: orgSlug,
    });

    // Create default subsidiary
    const subsidiaryRepository = new SubsidiaryRepository();
    const subsidiaryName = defaultSubsidiaryName || `${name} Main`;
    const subsidiaryCode = 'MAIN';

    const subsidiary = await subsidiaryRepository.create({
      organizationId: organization.id,
      name: subsidiaryName,
      code: subsidiaryCode,
      isActive: true,
    });

    return {
      organization: this.transformOrganization(organization),
      subsidiary: {
        id: subsidiary.id,
        name: subsidiary.name,
        code: subsidiary.code || 'MAIN',
      },
    };
  }

  /**
   * Find or provision organization from Clerk data
   *
   * If the organization exists, returns it. Otherwise provisions a new one
   * with a default subsidiary.
   */
  async findOrProvisionFromClerk(clerkOrgData: {
    clerkOrgId: string;
    name: string;
    slug?: string;
  }): Promise<Organization> {
    // Check if organization already exists
    const existing = await this.organizationRepository.findByClerkId(clerkOrgData.clerkOrgId);
    if (existing) {
      return this.transformOrganization(existing);
    }

    // Provision new organization with default subsidiary
    const result = await this.provisionFromClerk({
      clerkOrgId: clerkOrgData.clerkOrgId,
      name: clerkOrgData.name,
      slug: clerkOrgData.slug,
    });

    return result.organization;
  }
}