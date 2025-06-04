import { BaseRepository } from './base-repository';
export declare class OrganizationRepository extends BaseRepository {
    /**
     * Find an organization by Stytch organization ID
     */
    findByStytchId(stytchOrgId: string): Promise<{
        id: string;
        stytchOrgId: string;
        name: string;
        slug: string;
        settings: unknown;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    /**
     * Find an organization by ID
     */
    findById(id: string): Promise<{
        id: string;
        stytchOrgId: string;
        name: string;
        slug: string;
        settings: unknown;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    /**
     * Find an organization by slug
     */
    findBySlug(slug: string): Promise<{
        id: string;
        stytchOrgId: string;
        name: string;
        slug: string;
        settings: unknown;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    /**
     * Create a new organization
     */
    create(data: any): Promise<any>;
    /**
     * Update an organization
     */
    update(id: string, data: any): Promise<any>;
    /**
     * Format organization data by converting settings from jsonb to object
     */
    private formatOrganization;
}
//# sourceMappingURL=organization-repository.d.ts.map