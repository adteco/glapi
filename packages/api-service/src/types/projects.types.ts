import { z } from 'zod';

export const projectStatusEnum = z.enum([
  'PLANNING',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CLOSED',
  'CANCELLED',
]);

export const projectSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  subsidiaryId: z.string().uuid().nullable(),
  projectCode: z.string(),
  name: z.string(),
  status: projectStatusEnum,
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  externalSource: z.string().nullable(),
  jobNumber: z.string().nullable(),
  projectType: z.string().nullable(),
  retainagePercent: z.string(),
  currencyCode: z.string().nullable(),
  description: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Project = z.infer<typeof projectSchema>;

export const projectFiltersSchema = z.object({
  status: z.union([projectStatusEnum, z.array(projectStatusEnum)]).optional(),
  subsidiaryId: z.string().uuid().optional(),
  search: z.string().optional(),
  startDateFrom: z.string().optional(),
  startDateTo: z.string().optional(),
  endDateFrom: z.string().optional(),
  endDateTo: z.string().optional(),
}).optional();

export type ProjectFilters = z.infer<typeof projectFiltersSchema>;

export const createProjectInputSchema = z.object({
  projectCode: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  status: projectStatusEnum.optional(),
  subsidiaryId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  externalSource: z.string().optional(),
  jobNumber: z.string().optional(),
  projectType: z.string().optional(),
  retainagePercent: z.string().optional(),
  currencyCode: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateProjectInputSchema = createProjectInputSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;

export const projectParticipantSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  entityId: z.string().uuid().nullable(),
  participantRole: z.string(),
  isPrimary: z.boolean(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  entityName: z.string().nullable().optional(),
  entityType: z.string().nullable().optional(),
  entityExternalId: z.string().nullable().optional(),
});

export const projectParticipantInputSchema = z.object({
  entityId: z.string().uuid().nullable().optional(),
  participantRole: z.string().min(1),
  isPrimary: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ProjectParticipant = z.infer<typeof projectParticipantSchema>;
export type ProjectParticipantInput = z.infer<typeof projectParticipantInputSchema>;

export const projectAddressSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  addressType: z.enum(['JOB_SITE', 'SHIPPING', 'BILLING', 'OTHER']),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const projectAddressInputSchema = z.object({
  addressType: z.enum(['JOB_SITE', 'SHIPPING', 'BILLING', 'OTHER']),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ProjectAddress = z.infer<typeof projectAddressSchema>;
export type ProjectAddressInput = z.infer<typeof projectAddressInputSchema>;

export type ProjectWithRelations = Project & {
  participants: ProjectParticipant[];
  addresses: ProjectAddress[];
};
