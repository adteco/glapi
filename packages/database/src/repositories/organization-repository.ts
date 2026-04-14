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
   * Find an organization by Better Auth organization ID
   */
  async findByBetterAuthId(betterAuthOrgId: string) {
    const [result] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.betterAuthOrgId, betterAuthOrgId))
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
   * Create a new organization from Better Auth
   */
  async createFromBetterAuth(data: {
    betterAuthOrgId: string;
    name: string;
    slug: string;
    settings?: Record<string, unknown>;
  }) {
    // Prepare settings as jsonb if present
    const settings = data.settings ?
      (typeof data.settings === 'string' ?
        data.settings :
        JSON.stringify(data.settings)) :
      null;

    const [result] = await this.db
      .insert(organizations)
      .values({
        betterAuthOrgId: data.betterAuthOrgId,
        stytchOrgId: `better_auth_migration_${data.betterAuthOrgId}`, // Placeholder
        name: data.name,
        slug: data.slug,
        settings,
      })
      .returning();

    return this.formatOrganization(result);
  }

  /**
   * Create a new organization from Clerk
   * This handles the case where stytch_org_id may have a NOT NULL constraint
   * by providing a placeholder value for legacy compatibility.
   */
  async createFromClerk(data: {
    clerkOrgId: string;
    name: string;
    slug: string;
    settings?: Record<string, unknown>;
  }) {
    // Prepare settings as jsonb if present
    const settings = data.settings ?
      (typeof data.settings === 'string' ?
        data.settings :
        JSON.stringify(data.settings)) :
      null;

    // Create the organization with a placeholder stytch_org_id for legacy compatibility
    const [result] = await this.db
      .insert(organizations)
      .values({
        clerkOrgId: data.clerkOrgId,
        stytchOrgId: `clerk_migration_${data.clerkOrgId}`, // Placeholder for NOT NULL constraint
        name: data.name,
        slug: data.slug,
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