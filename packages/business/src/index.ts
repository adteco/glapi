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

// Export revenue calculation services
export * from './services/revenue-calculation-engine';
export * from './services/kit-service';
export * from './services/revenue-reporting-service';
export * from './types/revenue-calculation-types';
export * from './types/revenue-reporting-types';

export const placeholderBusinessLogic = () => {
  console.log('Business logic package placeholder');
}; 