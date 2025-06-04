"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const base_repository_1 = require("./base-repository");
const organizations_1 = require("../db/schema/organizations");
class OrganizationRepository extends base_repository_1.BaseRepository {
    /**
     * Find an organization by Stytch organization ID
     */
    async findByStytchId(stytchOrgId) {
        const [result] = await this.db
            .select()
            .from(organizations_1.organizations)
            .where((0, drizzle_orm_1.eq)(organizations_1.organizations.stytchOrgId, stytchOrgId))
            .limit(1);
        return result || null;
    }
    /**
     * Find an organization by ID
     */
    async findById(id) {
        const [result] = await this.db
            .select()
            .from(organizations_1.organizations)
            .where((0, drizzle_orm_1.eq)(organizations_1.organizations.id, id))
            .limit(1);
        return result || null;
    }
    /**
     * Find an organization by slug
     */
    async findBySlug(slug) {
        const [result] = await this.db
            .select()
            .from(organizations_1.organizations)
            .where((0, drizzle_orm_1.eq)(organizations_1.organizations.slug, slug))
            .limit(1);
        return result || null;
    }
    /**
     * Create a new organization
     */
    async create(data) {
        // Prepare settings as jsonb if present
        const settings = data.settings ?
            (typeof data.settings === 'string' ?
                data.settings :
                JSON.stringify(data.settings)) :
            null;
        // Create the organization
        const [result] = await this.db
            .insert(organizations_1.organizations)
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
    async update(id, data) {
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
            .update(organizations_1.organizations)
            .set({
            ...data,
            settings,
            updatedAt: new Date()
        })
            .where((0, drizzle_orm_1.eq)(organizations_1.organizations.id, id))
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
    formatOrganization(organization) {
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
exports.OrganizationRepository = OrganizationRepository;
//# sourceMappingURL=organization-repository.js.map