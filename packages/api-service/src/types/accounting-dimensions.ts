import { z } from 'zod';

// Base schema for accounting dimensions with common fields
const accountingDimensionBaseSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().min(1, 'Organization ID is required'),
  subsidiaryId: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Department schema
export const departmentSchema = accountingDimensionBaseSchema.extend({});

export type Department = z.infer<typeof departmentSchema>;
export type CreateDepartmentInput = Omit<Department, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateDepartmentInput = Partial<Omit<Department, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>;

// Schema for creating a new department
export const NewDepartmentSchema = departmentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Location schema with additional address fields
export const locationSchema = accountingDimensionBaseSchema.extend({
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  stateProvince: z.string().optional(),
  postalCode: z.string().optional(),
  countryCode: z.string().length(2).optional(), // ISO-2 country code
});

export type Location = z.infer<typeof locationSchema>;
export type CreateLocationInput = Omit<Location, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateLocationInput = Partial<Omit<Location, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>;

// Schema for creating a new location
export const NewLocationSchema = locationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Class schema
export const classSchema = accountingDimensionBaseSchema.extend({});

export type Class = z.infer<typeof classSchema>;
export type CreateClassInput = Omit<Class, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateClassInput = Partial<Omit<Class, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>;

// Schema for creating a new class
export const NewClassSchema = classSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});