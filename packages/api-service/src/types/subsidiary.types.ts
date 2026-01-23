/**
 * Subsidiary types - re-exported from @glapi/types for backward compatibility
 *
 * This file re-exports subsidiary types from the centralized @glapi/types package.
 * New code should import directly from '@glapi/types' when possible.
 */

// Re-export subsidiary types from centralized package
export {
  subsidiarySchema,
  type Subsidiary,
  createSubsidiarySchema,
  type CreateSubsidiaryInput,
  updateSubsidiarySchema,
  type UpdateSubsidiaryInput,
} from '@glapi/types';

// Legacy aliases for backward compatibility
import { createSubsidiarySchema, updateSubsidiarySchema } from '@glapi/types';

export const NewSubsidiarySchema = createSubsidiarySchema;
export const UpdateSubsidiarySchema = updateSubsidiarySchema;
