import { eq } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { organizations } from '../db/schema/organizations';

export class OrganizationRepository extends BaseRepository {
  /**
   * Find an organization by Stytch organization ID
   */
  async findByStytchId(stytchOrgId: string) {
    const [result] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.stytchOrgId, stytchOrgId))
      .limit(1);

    return result || null;
  }

  /**
   * Find an organization by Clerk organization ID
   */
  async findByClerkId(clerkOrgId: string) {
    const [result] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.clerkOrgId, clerkOrgId))
      .limit(1);

    return result || null;
  }
  
  /**
   * Find an organization by ID
   */
  async findById(id: string) {
    const [result] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    
    return result || null;
  }
  
  /**
   * Find an organization by slug
   */
  async findBySlug(slug: string) {
    const [result] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    
    return result || null;
  }
  
  /**
   * Create a new organization
   */
  async create(data: any) {
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
    
    // Format the result
    return this.formatOrganization(result);
  }
  
  /**
   * Update an organization
   */
  async update(id: string, data: any) {
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
      return null;
    }
    
    // Format the result
    return this.formatOrganization(result);
  }
  
  /**
   * Format organization data by converting settings from jsonb to object
   */
  private formatOrganization(organization: any) {
    return {
      ...organization,
      settings: organization.settings ? 
        (typeof organization.settings === 'string' ? 
          JSON.parse(organization.settings) : 
          organization.settings) : 
        undefined
    };
  }
}