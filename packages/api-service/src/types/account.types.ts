/**
 * Account types - re-exported from @glapi/types for backward compatibility
 *
 * This file re-exports chart of account types from the centralized @glapi/types package.
 * New code should import directly from '@glapi/types' when possible.
 */

// Re-export account types from centralized package
export {
  AccountCategoryEnum,
  type AccountCategory,
  accountSchema,
  type Account,
  createAccountSchema,
  type CreateAccountInput,
  updateAccountSchema,
  type UpdateAccountInput,
  newAccountSchema,
  type NewAccountInput,
  seedAccountSchema,
  type SeedAccountInput,
  type AccountFilters,
} from '@glapi/types';

// Legacy aliases for backward compatibility
import {
  createAccountSchema,
  updateAccountSchema,
  newAccountSchema,
  seedAccountSchema,
} from '@glapi/types';

export const CreateAccountSchema = createAccountSchema;
export const UpdateAccountSchema = updateAccountSchema;
export const NewAccountSchema = newAccountSchema;
export const SeedAccountSchema = seedAccountSchema;
