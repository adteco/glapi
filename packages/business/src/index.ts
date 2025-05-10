// Export core business objects, services, calculations etc.

// Example structure based on entity-centric approach:
// export * from './transaction'; // Core transaction business object/logic
// export * from './invoice';     // Invoice-specific business logic
// export * from './sales-order'; // SalesOrder-specific business logic
// export * from './estimate';    // Estimate-specific business logic

// Export calculation helpers
// export * from './calculations/costing';
// export * from './calculations/revenue';

// Export placeholder from transaction.ts for now
export * from './transaction';

export const placeholderBusinessLogic = () => {
  console.log('Business logic package placeholder');
}; 