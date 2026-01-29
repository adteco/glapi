import { z } from 'zod';

export const organizationSchema = z.object({
  id: z.string().uuid().optional(),
  stytchOrgId: z.string().optional(), // Legacy - optional for Clerk orgs
  clerkOrgId: z.string().optional(),  // Clerk organization ID (org_xxxxx format)
  name: z.string(),
  slug: z.string(),
  settings: z.record(z.any()).optional(),
});

export type Organization = z.infer<typeof organizationSchema>;
export type CreateOrganizationInput = Omit<Organization, 'id'>;

/**
 * Input for provisioning an organization from Clerk
 */
export interface ProvisionClerkOrganizationInput {
  clerkOrgId: string;      // Clerk organization ID (org_xxxxx)
  name: string;            // Organization name
  slug?: string;           // Optional slug (defaults to slugified name)
  defaultSubsidiaryName?: string; // Name for default subsidiary (defaults to "{name} Main")
}