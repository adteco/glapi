import { z } from 'zod';

// Entity types enum
export const EntityTypeEnum = z.enum([
  'Customer',
  'Vendor', 
  'Employee',
  'Partner',
  'Lead',
  'Prospect',
  'Contact'
]);

export type EntityType = z.infer<typeof EntityTypeEnum>;

// Address schema
export const EntityAddressSchema = z.object({
  id: z.string().uuid().optional(),
  addressee: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  attention: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  line1: z.string().optional().nullable(),
  line2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  stateProvince: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  countryCode: z.string().length(2).optional().nullable(),
});

export type EntityAddress = z.infer<typeof EntityAddressSchema>;

// Base entity schema (common fields)
export const BaseEntitySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  name: z.string(),
  displayName: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  entityTypes: z.array(EntityTypeEnum),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  address: EntityAddressSchema.optional().nullable(),
  parentEntityId: z.string().uuid().optional().nullable(),
  primaryContactId: z.string().uuid().optional().nullable(),
  taxId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  customFields: z.record(z.any()).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BaseEntity = z.infer<typeof BaseEntitySchema>;

// Create entity schema (for API input)
export const CreateEntitySchema = BaseEntitySchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateEntityInput = z.infer<typeof CreateEntitySchema>;

// Update entity schema (for API input)
export const UpdateEntitySchema = CreateEntitySchema.partial();

export type UpdateEntityInput = z.infer<typeof UpdateEntitySchema>;

// Vendor-specific fields
export const VendorMetadataSchema = z.object({
  paymentTerms: z.string().optional(),
  vendorType: z.string().optional(),
  ein: z.string().optional(),
  w9OnFile: z.boolean().optional(),
  defaultExpenseAccount: z.string().optional(),
});

export type VendorMetadata = z.infer<typeof VendorMetadataSchema>;

// Employee-specific fields
export const EmployeeMetadataSchema = z.object({
  employeeId: z.string().optional(),
  department: z.string().optional(),
  title: z.string().optional(),
  reportsTo: z.string().uuid().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  employmentType: z.enum(['full-time', 'part-time', 'contractor', 'intern']).optional(),
});

export type EmployeeMetadata = z.infer<typeof EmployeeMetadataSchema>;

// Contact-specific fields
export const ContactMetadataSchema = z.object({
  title: z.string().optional(),
  department: z.string().optional(),
  reportsTo: z.string().uuid().optional(),
  mobilePhone: z.string().optional(),
  workPhone: z.string().optional(),
  preferredContactMethod: z.enum(['email', 'phone', 'mobile']).optional(),
});

export type ContactMetadata = z.infer<typeof ContactMetadataSchema>;

// Lead/Prospect-specific fields
export const LeadProspectMetadataSchema = z.object({
  source: z.string().optional(),
  industry: z.string().optional(),
  annualRevenue: z.number().optional(),
  numberOfEmployees: z.number().optional(),
  leadScore: z.number().optional(),
  assignedTo: z.string().uuid().optional(),
  convertedDate: z.string().datetime().optional(),
  convertedToId: z.string().uuid().optional(),
});

export type LeadProspectMetadata = z.infer<typeof LeadProspectMetadataSchema>;

// List query params
export const EntityListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  orderBy: z.enum(['name', 'createdAt', 'updatedAt']).optional().default('name'),
  orderDirection: z.enum(['asc', 'desc']).optional().default('asc'),
  status: z.string().optional(),
  search: z.string().optional(),
  parentEntityId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
});

export type EntityListQuery = z.infer<typeof EntityListQuerySchema>;

// API Response types
export interface EntityListResponse {
  data: BaseEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}