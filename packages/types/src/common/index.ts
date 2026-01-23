/**
 * Common types used across the GLAPI system
 *
 * This module contains foundational types for pagination, addresses,
 * date ranges, error handling, and other commonly used patterns.
 */

import { z } from 'zod';

// ============================================================================
// Zod Helpers
// ============================================================================

/**
 * Preprocessor that converts empty strings to undefined
 * Useful for optional form fields that may submit empty strings
 */
export const emptyStringToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === '' ? undefined : val), schema);

/**
 * Preprocessor that converts empty strings to null
 * Useful for nullable form fields that may submit empty strings
 */
export const emptyStringToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === '' ? null : val), schema);

/**
 * Optional UUID that handles empty strings from forms
 */
export const optionalUuidSchema = emptyStringToUndefined(z.string().uuid().optional());

/**
 * Nullable optional UUID that handles empty strings from forms
 */
export const nullableOptionalUuidSchema = emptyStringToNull(z.string().uuid().nullable().optional());

// ============================================================================
// Date Patterns
// ============================================================================

/**
 * Date string in YYYY-MM-DD format
 */
export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

/**
 * Optional date string in YYYY-MM-DD format
 */
export const optionalDateStringSchema = dateStringSchema.optional();

/**
 * Date range schema for filtering
 */
export const dateRangeSchema = z.object({
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
});

export type DateRange = z.infer<typeof dateRangeSchema>;

// ============================================================================
// Number Patterns
// ============================================================================

/**
 * Decimal number as string with up to 2 decimal places
 * Used for hours, quantities, etc.
 */
export const decimalStringSchema = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a positive number');

/**
 * Decimal number as string with up to 4 decimal places
 * Used for rates, prices, etc.
 */
export const rateStringSchema = z.string().regex(/^\d+(\.\d{1,4})?$/, 'Rate must be a positive number');

/**
 * Currency amount as string (up to 2 decimal places)
 */
export const currencyStringSchema = z.string().regex(/^-?\d+(\.\d{1,2})?$/, 'Amount must be a valid currency value');

// ============================================================================
// Pagination
// ============================================================================

/**
 * Pagination input parameters schema
 */
export const paginationInputSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(50),
});

export type PaginationInput = z.infer<typeof paginationInputSchema>;

/**
 * Optional pagination input schema (for endpoints where pagination is optional)
 */
export const optionalPaginationInputSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
});

export type OptionalPaginationInput = z.infer<typeof optionalPaginationInputSchema>;

/**
 * Pagination metadata returned in paginated responses
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Generic paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Create a paginated result from data and pagination params
 */
export function createPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ============================================================================
// Sorting
// ============================================================================

/**
 * Sort direction enum
 */
export const sortDirectionSchema = z.enum(['asc', 'desc']);
export type SortDirection = z.infer<typeof sortDirectionSchema>;

/**
 * Generic sort input schema factory
 * @param allowedFields - Array of allowed field names for sorting
 */
export function createSortInputSchema<T extends string>(allowedFields: readonly T[]) {
  return z.object({
    orderBy: z.enum(allowedFields as [T, ...T[]]).optional(),
    orderDirection: sortDirectionSchema.optional(),
  });
}

// ============================================================================
// Address
// ============================================================================

/**
 * Address schema for physical addresses
 */
export const addressSchema = z.object({
  street: z.string().max(255).optional(),
  street2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
});

export type Address = z.infer<typeof addressSchema>;

/**
 * Full address schema with required fields
 */
export const requiredAddressSchema = z.object({
  street: z.string().min(1).max(255),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(1).max(100),
  street2: z.string().max(255).optional(),
});

export type RequiredAddress = z.infer<typeof requiredAddressSchema>;

// ============================================================================
// Contact Information
// ============================================================================

/**
 * Email schema with validation
 */
export const emailSchema = z.string().email().max(255);

/**
 * Phone number schema (flexible format)
 */
export const phoneSchema = z.string().max(50).optional();

/**
 * Contact info schema
 */
export const contactInfoSchema = z.object({
  email: emailSchema.optional(),
  phone: phoneSchema,
  fax: phoneSchema,
  website: z.string().url().max(255).optional(),
});

export type ContactInfo = z.infer<typeof contactInfoSchema>;

// ============================================================================
// Service Context
// ============================================================================

/**
 * Service context passed to all service methods
 * Contains authentication and organization context
 */
export interface ServiceContext {
  organizationId?: string;
  subsidiaryId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  roles?: string[];
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Standard API error response structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  field?: string;
}

/**
 * Standard error codes used throughout the API
 */
export const ErrorCodes = {
  // Client errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  BAD_REQUEST: 'BAD_REQUEST',

  // Business logic errors
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
  RATE_NOT_FOUND: 'RATE_NOT_FOUND',

  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Custom service error class
 */
export class ServiceError extends Error {
  code: ErrorCode;
  statusCode: number;
  details?: Record<string, unknown>;
  field?: string;

  constructor(
    message: string,
    code: ErrorCode,
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

// ============================================================================
// Metadata
// ============================================================================

/**
 * Generic metadata schema for extensible data storage
 */
export const metadataSchema = z.record(z.unknown()).nullable().optional();
export type Metadata = z.infer<typeof metadataSchema>;

// ============================================================================
// ID Schemas
// ============================================================================

/**
 * UUID string schema
 */
export const uuidSchema = z.string().uuid();

/**
 * Array of UUIDs schema (min 1)
 */
export const uuidArraySchema = z.array(uuidSchema).min(1);

/**
 * Input schema for single ID operations
 */
export const byIdInputSchema = z.object({
  id: uuidSchema,
});

export type ByIdInput = z.infer<typeof byIdInputSchema>;

// ============================================================================
// Common Status Patterns
// ============================================================================

/**
 * Active/inactive status schema
 */
export const activeStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export type ActiveStatus = z.infer<typeof activeStatusSchema>;

/**
 * Common record status for entities that can be archived
 */
export const recordStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);
export type RecordStatus = z.infer<typeof recordStatusSchema>;
