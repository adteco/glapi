import { eq, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { organizations } from '../db/schema/organizations';
import { hasSchemaColumn } from './schema-compatibility';

type OrganizationSchemaSupport = {
  betterAuthOrgId: boolean;
};

let organizationSchemaSupportPromise: Promise<OrganizationSchemaSupport> | null = null;

export class OrganizationRepository extends BaseRepository {
  private async getSchemaSupport(): Promise<OrganizationSchemaSupport> {
    if (!organizationSchemaSupportPromise) {
      organizationSchemaSupportPromise = this.db
        .execute(sql`
          select column_name
          from information_schema.columns
          where table_schema = current_schema()
            and table_name = 'organizations'
            and column_name in ('better_auth_org_id')
        `)
        .then((result) => {
          return {
            betterAuthOrgId: hasSchemaColumn(
              result.rows as { column_name?: string | null }[] | undefined,
              'better_auth_org_id'
            ),
          };
        })
        .catch(() => ({
          // Default to the current schema shape if introspection fails.
          betterAuthOrgId: true,
        }));
    }

    return organizationSchemaSupportPromise;
  }

  private async getSelection() {
    const support = await this.getSchemaSupport();

    return {
      id: organizations.id,
      stytchOrgId: organizations.stytchOrgId,
      clerkOrgId: organizations.clerkOrgId,
      betterAuthOrgId: support.betterAuthOrgId
        ? organizations.betterAuthOrgId
        : sql<string | null>`null`,
      stripeCustomerId: organizations.stripeCustomerId,
      stripeAccountId: organizations.stripeAccountId,
      stripeConnectStatus: organizations.stripeConnectStatus,
      stripeChargesEnabled: organizations.stripeChargesEnabled,
      stripePayoutsEnabled: organizations.stripePayoutsEnabled,
      stripeOnboardingCompletedAt: organizations.stripeOnboardingCompletedAt,
      stripeDefaultPaymentMethodId: organizations.stripeDefaultPaymentMethodId,
      name: organizations.name,
      slug: organizations.slug,
      settings: organizations.settings,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
    };
  }

  /**
   * Find an organization by Stytch organization ID
   */
  async findByStytchId(stytchOrgId: string) {
    const selection = await this.getSelection();
    const [result] = await this.db
      .select(selection)
      .from(organizations)
      .where(eq(organizations.stytchOrgId, stytchOrgId))
      .limit(1);

    return result || null;
  }

  /**
   * Find an organization by Better Auth organization ID
   */
  async findByBetterAuthId(betterAuthOrgId: string) {
    const support = await this.getSchemaSupport();
    if (!support.betterAuthOrgId) {
      return null;
    }

    const selection = await this.getSelection();
    const [result] = await this.db
      .select(selection)
      .from(organizations)
      .where(eq(organizations.betterAuthOrgId, betterAuthOrgId))
      .limit(1);

    return result || null;
  }

  /**
   * Find an organization by Clerk organization ID
   */
  async findByClerkId(clerkOrgId: string) {
    const selection = await this.getSelection();
    const [result] = await this.db
      .select(selection)
      .from(organizations)
      .where(eq(organizations.clerkOrgId, clerkOrgId))
      .limit(1);

    return result || null;
  }
  
  /**
   * Find an organization by ID
   */
  async findById(id: string) {
    const selection = await this.getSelection();
    const [result] = await this.db
      .select(selection)
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    
    return result || null;
  }
  
  /**
   * Find an organization by slug
   */
  async findBySlug(slug: string) {
    const selection = await this.getSelection();
    const [result] = await this.db
      .select(selection)
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    
    return result || null;
  }
  
  /**
   * Create a new organization
   */
  async create(data: any) {
    const selection = await this.getSelection();
    const support = await this.getSchemaSupport();

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
        ...(support.betterAuthOrgId ? {} : { betterAuthOrgId: undefined }),
        settings,
      })
      .returning(selection);

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
    const support = await this.getSchemaSupport();
    if (!support.betterAuthOrgId) {
      throw new Error('better_auth_org_id column is required for Better Auth organization provisioning');
    }

    const selection = await this.getSelection();

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
      .returning(selection);

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
    const selection = await this.getSelection();

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
      .returning(selection);

    // Format the result
    return this.formatOrganization(result);
  }
  
  /**
   * Update an organization
   */
  async update(id: string, data: any) {
    const selection = await this.getSelection();
    const support = await this.getSchemaSupport();

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
        ...(support.betterAuthOrgId ? {} : { betterAuthOrgId: undefined }),
        settings,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, id))
      .returning(selection);
    
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
