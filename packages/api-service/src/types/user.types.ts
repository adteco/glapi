import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().uuid().optional(),
  stytchUserId: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  organizationId: z.string().min(1, 'Organization ID is required'),
  role: z.enum(['admin', 'user']).default('user'),
  settings: z.record(z.any()).optional(),
  isActive: z.boolean().default(true),
  lastLogin: z.date().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLogin'>;
export type UpdateUserInput = Partial<Omit<User, 'id' | 'stytchUserId' | 'organizationId' | 'createdAt' | 'updatedAt'>>;