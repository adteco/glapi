/**
 * Accounting dimension types - re-exported from @glapi/types for backward compatibility
 *
 * This file re-exports accounting dimension types from the centralized @glapi/types package.
 * New code should import directly from '@glapi/types' when possible.
 */

// Re-export accounting dimension types from centralized package
export {
  // Department
  departmentSchema,
  type Department,
  createDepartmentSchema,
  type CreateDepartmentInput,
  updateDepartmentSchema,
  type UpdateDepartmentInput,

  // Location
  locationSchema,
  type Location,
  createLocationSchema,
  type CreateLocationInput,
  updateLocationSchema,
  type UpdateLocationInput,

  // Class
  classSchema,
  type Class,
  createClassSchema,
  type CreateClassInput,
  updateClassSchema,
  type UpdateClassInput,
} from '@glapi/types';

// Legacy aliases for backward compatibility
import {
  createDepartmentSchema,
  createLocationSchema,
  createClassSchema,
} from '@glapi/types';

export const NewDepartmentSchema = createDepartmentSchema;
export const NewLocationSchema = createLocationSchema;
export const NewClassSchema = createClassSchema;
