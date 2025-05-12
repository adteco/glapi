import { z } from 'zod';

export const organizationSchema = z.object({
  id: z.string().uuid().optional(),
  stytchOrgId: z.string(),
  name: z.string(),
  slug: z.string(),
  settings: z.record(z.any()).optional(),
});

export type Organization = z.infer<typeof organizationSchema>;
export type CreateOrganizationInput = Omit<Organization, 'id'>;