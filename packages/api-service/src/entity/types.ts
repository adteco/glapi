/**
 * Entity types - re-exported from @glapi/types for backward compatibility
 *
 * This file re-exports entity types from the centralized @glapi/types package.
 * New code should import directly from '@glapi/types' when possible.
 */

// Re-export all entity types from centralized package
export {
  // Entity type enum
  EntityTypeEnum,
  type EntityType,

  // Entity status
  EntityStatusEnum,
  type EntityStatus,

  // Entity address
  entityAddressSchema,
  type EntityAddress,

  // Base entity
  baseEntitySchema,
  type BaseEntity,
  createEntitySchema,
  type CreateEntityInput,
  updateEntitySchema,
  type UpdateEntityInput,

  // Customer types
  customerMetadataSchema,
  type CustomerMetadata,
  customerSchema,
  type Customer,
  createCustomerSchema,
  type CreateCustomerInput,
  updateCustomerSchema,
  type UpdateCustomerInput,

  // Vendor types
  vendorMetadataSchema,
  type VendorMetadata,

  // Employee types
  EmploymentTypeEnum,
  type EmploymentType,
  employeeMetadataSchema,
  type EmployeeMetadata,

  // Contact types
  PreferredContactMethodEnum,
  type PreferredContactMethod,
  contactMetadataSchema,
  type ContactMetadata,

  // Lead/Prospect types
  leadProspectMetadataSchema,
  type LeadProspectMetadata,

  // Social handles (shared across entity types)
  socialHandlesSchema,
  type SocialHandles,

  // Entity list query
  entityListQuerySchema,
  type EntityListQuery,
  type EntityListResponse,
} from '@glapi/types';

// Legacy aliases for backward compatibility
// The api-service used different naming conventions
import {
  entityAddressSchema,
  baseEntitySchema,
  createEntitySchema,
  updateEntitySchema,
  vendorMetadataSchema,
  employeeMetadataSchema,
  contactMetadataSchema,
  leadProspectMetadataSchema,
  entityListQuerySchema,
} from '@glapi/types';

export const EntityAddressSchema = entityAddressSchema;
export const BaseEntitySchema = baseEntitySchema;
export const CreateEntitySchema = createEntitySchema;
export const UpdateEntitySchema = updateEntitySchema;
export const VendorMetadataSchema = vendorMetadataSchema;
export const EmployeeMetadataSchema = employeeMetadataSchema;
export const ContactMetadataSchema = contactMetadataSchema;
export const LeadProspectMetadataSchema = leadProspectMetadataSchema;
export const EntityListQuerySchema = entityListQuerySchema;
