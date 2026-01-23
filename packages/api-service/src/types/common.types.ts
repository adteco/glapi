/**
 * Common types - re-exported from @glapi/types for backward compatibility
 *
 * This file re-exports common types from the centralized @glapi/types package.
 * New code should import directly from '@glapi/types' when possible.
 */

// Re-export common types from centralized package
export {
  // Zod helpers
  emptyStringToUndefined,
  emptyStringToNull,
  optionalUuidSchema,
  nullableOptionalUuidSchema,

  // Date patterns
  dateStringSchema,
  optionalDateStringSchema,
  dateRangeSchema,
  type DateRange,

  // Number patterns
  decimalStringSchema,
  rateStringSchema,
  currencyStringSchema,

  // Pagination
  paginationInputSchema,
  type PaginationInput,
  optionalPaginationInputSchema,
  type OptionalPaginationInput,
  type PaginationMeta,
  type PaginatedResult,
  createPaginatedResult,

  // Sorting
  sortDirectionSchema,
  type SortDirection,
  createSortInputSchema,

  // Address
  addressSchema,
  type Address,
  requiredAddressSchema,
  type RequiredAddress,

  // Contact
  emailSchema,
  phoneSchema,
  contactInfoSchema,
  type ContactInfo,

  // Service context
  type ServiceContext,

  // Error codes constant (for reference)
  ErrorCodes,

  // Metadata
  metadataSchema,
  type Metadata,

  // ID schemas
  uuidSchema,
  uuidArraySchema,
  byIdInputSchema,
  type ByIdInput,

  // Status patterns
  activeStatusSchema,
  type ActiveStatus,
  recordStatusSchema,
  type RecordStatus,
} from '@glapi/types';

// Legacy alias for backward compatibility
export type PaginationParams = {
  page?: number;
  limit?: number;
};

/**
 * Standard API error response structure
 * More flexible than @glapi/types version to support custom error codes
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  field?: string;
}

/**
 * Custom service error class
 * More flexible than @glapi/types version to support custom error codes
 */
export class ServiceError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
  field?: string;

  constructor(
    message: string,
    code: string,
    statusCode: number = 400,
    details?: Record<string, unknown>,
    field?: string
  ) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.field = field;
  }

  toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      field: this.field,
    };
  }
}
