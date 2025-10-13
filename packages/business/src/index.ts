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

// Export forecasting and analytics services
export * from './services/revenue-forecasting-engine';
export * from './services/cohort-analysis-service';
export * from './services/churn-prediction-service';
export * from './services/scenario-analysis-service';

// Export contract modification services
export * from './services/contract-modification-engine';
export * from './services/modification-approval-workflow';

// Export SSP analytics services
export * from './services/ssp-analytics-engine';
export * from './services/ssp-exception-monitor';
// Export the wrapper instead of the actual service to avoid TensorFlow bundling issues
export { SSPMLTrainingService, ModelMetrics } from './services/ssp-ml-training-service-wrapper';

// Export types
export * from './types/revenue-calculation-types';
export * from './types/revenue-reporting-types';

export const placeholderBusinessLogic = () => {
  console.log('Business logic package placeholder');
}; 