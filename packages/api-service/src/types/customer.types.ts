import { z } from 'zod';
import { addressSchema } from './common.types';

export const customerSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  companyName: z.string(),
  customerId: z.string(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  billingAddress: addressSchema.optional(),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type Customer = z.infer<typeof customerSchema>;
export type CreateCustomerInput = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;

// Schema for creating a new customer, corresponding to CreateCustomerInput
export const NewCustomerSchema = customerSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UpdateCustomerInput = Partial<Omit<Customer, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>;