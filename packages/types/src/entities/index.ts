/**
 * Entity types for customers, vendors, employees, and other business entities
 *
 * This module contains type definitions for core business entities used
 * throughout the GLAPI system.
 */

import { z } from 'zod';
import {
  uuidSchema,
  metadataSchema,
  addressSchema,
  type PaginatedResult,
} from '../common';

// ============================================================================
// Entity Type Enum
// ============================================================================

/**
 * Types of entities in the system
 */
export const EntityTypeEnum = z.enum([
  'Customer',
  'Vendor',
  'Employee',
  'Partner',
  'Lead',
  'Prospect',
  'Contact',
]);

export type EntityType = z.infer<typeof EntityTypeEnum>;

// ============================================================================
// Entity Status
// ============================================================================

/**
 * Entity status values
 */
export const EntityStatusEnum = z.enum(['active', 'inactive', 'archived']);
export type EntityStatus = z.infer<typeof EntityStatusEnum>;

// ============================================================================
// Entity Address
// ============================================================================

/**
 * Extended address schema for entities with additional fields
 */
export const entityAddressSchema = z.object({
  id: uuidSchema.optional(),
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

export type EntityAddress = z.infer<typeof entityAddressSchema>;

// ============================================================================
// Base Entity Schema
// ============================================================================

/**
 * Base entity schema with common fields for all entity types
 */
export const baseEntitySchema = z.object({
  id: uuidSchema,
  organizationId: z.string(),
  name: z.string().min(1, 'Name is required'),
  displayName: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  entityTypes: z.array(EntityTypeEnum).min(1, 'At least one entity type is required'),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  address: entityAddressSchema.optional().nullable(),
  parentEntityId: uuidSchema.optional().nullable(),
  primaryContactId: uuidSchema.optional().nullable(),
  taxId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  customFields: z.record(z.unknown()).optional().nullable(),
  metadata: metadataSchema,
  status: EntityStatusEnum.default('active'),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BaseEntity = z.infer<typeof baseEntitySchema>;

/**
 * Schema for creating a new entity
 */
export const createEntitySchema = baseEntitySchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateEntityInput = z.infer<typeof createEntitySchema>;

/**
 * Schema for updating an entity
 */
export const updateEntitySchema = createEntitySchema.partial();

export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;

// ============================================================================
// Customer Types
// ============================================================================

/**
 * Customer-specific metadata
 */
export const customerMetadataSchema = z.object({
  paymentTerms: z.string().optional(),
  creditLimit: z.string().optional(),
  priceLevel: z.string().optional(),
  salesRep: z.string().optional(),
  currency: z.string().max(3).optional(),
});

export type CustomerMetadata = z.infer<typeof customerMetadataSchema>;

/**
 * Customer schema - simplified version for customer service
 */
export const customerSchema = z.object({
  id: uuidSchema.optional(),
  organizationId: z.string().min(1, 'Organization ID is required'),
  companyName: z.string().min(1, 'Company name is required'),
  customerId: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  billingAddress: addressSchema.optional(),
  parentCustomerId: uuidSchema.optional(),
  status: EntityStatusEnum.default('active'),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type Customer = z.infer<typeof customerSchema>;

/**
 * Schema for creating a new customer
 */
export const createCustomerSchema = customerSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

/**
 * Schema for updating a customer
 */
export const updateCustomerSchema = createCustomerSchema
  .omit({ organizationId: true })
  .partial();

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

// ============================================================================
// Vendor Types
// ============================================================================

/**
 * Vendor-specific metadata
 */
export const vendorMetadataSchema = z.object({
  paymentTerms: z.string().optional(),
  vendorType: z.string().optional(),
  ein: z.string().optional(),
  w9OnFile: z.boolean().optional(),
  defaultExpenseAccount: z.string().optional(),
});

export type VendorMetadata = z.infer<typeof vendorMetadataSchema>;

// ============================================================================
// Employee Types
// ============================================================================

/**
 * Employment type enum
 */
export const EmploymentTypeEnum = z.enum([
  'full-time',
  'part-time',
  'contractor',
  'intern',
]);

export type EmploymentType = z.infer<typeof EmploymentTypeEnum>;

/**
 * Employee-specific metadata
 */
export const employeeMetadataSchema = z.object({
  employeeId: z.string().optional(),
  department: z.string().optional(),
  title: z.string().optional(),
  reportsTo: uuidSchema.optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  employmentType: EmploymentTypeEnum.optional(),
});

export type EmployeeMetadata = z.infer<typeof employeeMetadataSchema>;

// ============================================================================
// Contact Types
// ============================================================================

/**
 * Preferred contact method enum
 */
export const PreferredContactMethodEnum = z.enum(['email', 'phone', 'mobile']);
export type PreferredContactMethod = z.infer<typeof PreferredContactMethodEnum>;

/**
 * Contact-specific metadata
 */
export const contactMetadataSchema = z.object({
  title: z.string().optional(),
  department: z.string().optional(),
  reportsTo: uuidSchema.optional(),
  mobilePhone: z.string().optional(),
  workPhone: z.string().optional(),
  preferredContactMethod: PreferredContactMethodEnum.optional(),
});

export type ContactMetadata = z.infer<typeof contactMetadataSchema>;

// ============================================================================
// Lead/Prospect Types
// ============================================================================

/**
 * Lead/Prospect-specific metadata
 */
export const leadProspectMetadataSchema = z.object({
  source: z.string().optional(),
  industry: z.string().optional(),
  annualRevenue: z.number().optional(),
  numberOfEmployees: z.number().optional(),
  leadScore: z.number().optional(),
  assignedTo: uuidSchema.optional(),
  convertedDate: z.string().datetime().optional(),
  convertedToId: uuidSchema.optional(),
});

export type LeadProspectMetadata = z.infer<typeof leadProspectMetadataSchema>;

// ============================================================================
// Entity List Query
// ============================================================================

/**
 * Entity list query parameters
 */
export const entityListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  orderBy: z.enum(['name', 'createdAt', 'updatedAt']).optional().default('name'),
  orderDirection: z.enum(['asc', 'desc']).optional().default('asc'),
  status: z.string().optional(),
  search: z.string().optional(),
  parentEntityId: uuidSchema.optional(),
  isActive: z.coerce.boolean().optional(),
});

export type EntityListQuery = z.infer<typeof entityListQuerySchema>;

/**
 * Entity list response type
 */
export type EntityListResponse = PaginatedResult<BaseEntity>;
