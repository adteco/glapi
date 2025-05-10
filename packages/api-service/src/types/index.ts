import { z } from 'zod';

// Organization
export const organizationSchema = z.object({
  id: z.string().uuid().optional(),
  stytchOrgId: z.string(),
  name: z.string(),
  slug: z.string(),
  settings: z.record(z.any()).optional(),
});

export type Organization = z.infer<typeof organizationSchema>;
export type CreateOrganizationInput = Omit<Organization, 'id'>;

// Customer
export const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

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
export type Address = z.infer<typeof addressSchema>;
export type CreateCustomerInput = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;

// Schema for creating a new customer, corresponding to CreateCustomerInput
export const NewCustomerSchema = customerSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UpdateCustomerInput = Partial<Omit<Customer, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>;

// User
export const userSchema = z.object({
  id: z.string().uuid().optional(),
  stytchUserId: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  organizationId: z.string().uuid(),
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

// Service context
export interface ServiceContext {
  organizationId?: string;
  userId?: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Error types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export class ServiceError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, any>;

  constructor(message: string, code: string, statusCode: number = 400, details?: Record<string, any>) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}