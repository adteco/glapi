import { eq } from 'drizzle-orm';
import { BaseService } from './base-service';
import { 
  Organization, 
  CreateOrganizationInput, 
  ServiceError 
} from '../types';
import { organizations } from '@glapi/database/src/db/schema/organizations';

export class OrganizationService extends BaseService {
  /**
   * Get organization by Stytch organization ID
   */
  async getOrganizationByStytchId(stytchOrgId: string): Promise<Organization | null> {
    const [result] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.stytchOrgId, stytchOrgId))
      .limit(1);
    
    return result || null;
  }
  
  /**
   * Get organization by ID
   */
  async getOrganizationById(id: string): Promise<Organization | null> {
    const [result] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    
    return result || null;
  }
  
  /**
   * Create a new organization
   */
  async createOrganization(data: CreateOrganizationInput): Promise<Organization> {
    // Check if organization with this Stytch ID already exists
    const existing = await this.getOrganizationByStytchId(data.stytchOrgId);
    if (existing) {
      throw new ServiceError(
        `Organization with Stytch ID "${data.stytchOrgId}" already exists`,
        'DUPLICATE_ORGANIZATION',
        400
      );
    }
    
    // Check if slug is already in use
    const [slugExists] = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, data.slug))
      .limit(1);
    
    if (slugExists) {
      throw new ServiceError(
        `Organization with slug "${data.slug}" already exists`,
        'DUPLICATE_SLUG',
        400
      );
    }
    
    // Prepare settings as jsonb if present
    const settings = data.settings ? 
      (typeof data.settings === 'string' ? 
        data.settings : 
        JSON.stringify(data.settings)) : 
      null;
    
    // Create the organization
    const [result] = await this.db
      .insert(organizations)
      .values({
        ...data,
        settings,
      })
      .returning();
    
    // Convert settings back to object if needed
    return {
      ...result,
      settings: result.settings ? 
        (typeof result.settings === 'string' ? 
          JSON.parse(result.settings) : 
          result.settings) : 
        undefined
    };
  }
  
  /**
   * Update an organization
   */
  async updateOrganization(id: string, data: Partial<Organization>): Promise<Organization> {
    // Verify organization exists
    const existing = await this.getOrganizationById(id);
    if (!existing) {
      throw new ServiceError(
        `Organization with ID "${id}" not found`,
        'ORGANIZATION_NOT_FOUND',
        404
      );
    }
    
    // If updating slug, check it's not already in use
    if (data.slug && data.slug !== existing.slug) {
      const [slugExists] = await this.db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, data.slug))
        .limit(1);
      
      if (slugExists) {
        throw new ServiceError(
          `Organization with slug "${data.slug}" already exists`,
          'DUPLICATE_SLUG',
          400
        );
      }
    }
    
    // Prepare settings as jsonb if present
    let settings = undefined;
    if (data.settings !== undefined) {
      settings = data.settings ? 
        (typeof data.settings === 'string' ? 
          data.settings : 
          JSON.stringify(data.settings)) : 
        null;
    }
    
    // Update the organization
    const [result] = await this.db
      .update(organizations)
      .set({
        ...data,
        settings,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, id))
      .returning();
    
    if (!result) {
      throw new ServiceError(
        `Failed to update organization with ID "${id}"`,
        'UPDATE_FAILED',
        500
      );
    }
    
    // Convert settings back to object if needed
    return {
      ...result,
      settings: result.settings ? 
        (typeof result.settings === 'string' ? 
          JSON.parse(result.settings) : 
          result.settings) : 
        undefined
    };
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
    const existing = await this.getOrganizationByStytchId(stytchOrgData.organization_id);
    if (existing) {
      return existing;
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