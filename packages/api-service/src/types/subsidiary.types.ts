import { z } from 'zod';

export const subsidiarySchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  description: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type Subsidiary = z.infer<typeof subsidiarySchema>;
export type CreateSubsidiaryInput = Omit<Subsidiary, 'id' | 'createdAt' | 'updatedAt'>;

// Schema for creating a new subsidiary
export const NewSubsidiarySchema = subsidiarySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UpdateSubsidiaryInput = Partial<Omit<Subsidiary, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>;

// Schema for updating a subsidiary
export const UpdateSubsidiarySchema = subsidiarySchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
}).partial();