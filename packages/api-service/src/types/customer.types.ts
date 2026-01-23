/**
 * Customer types - re-exported from @glapi/types for backward compatibility
 *
 * This file re-exports customer types from the centralized @glapi/types package.
 * New code should import directly from '@glapi/types' when possible.
 */

// Re-export customer types from centralized package
export {
  customerSchema,
  type Customer,
  createCustomerSchema,
  type CreateCustomerInput,
  updateCustomerSchema,
  type UpdateCustomerInput,
} from '@glapi/types';

// Legacy alias for backward compatibility
import { createCustomerSchema } from '@glapi/types';

export const NewCustomerSchema = createCustomerSchema;
