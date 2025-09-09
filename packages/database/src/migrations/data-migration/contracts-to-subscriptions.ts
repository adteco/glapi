/**
 * Contracts to Subscriptions Migration
 * Migrates legacy contract data to the new subscription model
 */

import { v4 as uuidv4 } from 'uuid';
import {
  subscriptions,
  subscriptionItems,
  performanceObligations,
  contractSspAllocations,
  type NewSubscription,
  type NewSubscriptionItem,
  type NewPerformanceObligation,
  type NewContractSSPAllocation
} from '../../db/schema';
import {
  MigrationContext,
  MigrationStep,
  StepResult,
  LegacyContract,
  LegacyLineItem,
  ValidationResult,
  MigrationError
} from './types';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Create migration steps for contracts to subscriptions
 */
export function createContractMigrationSteps(): MigrationStep[] {
  return [
    {
      id: 'extract-legacy-contracts',
      name: 'Extract Legacy Contracts',
      description: 'Extract contract data from legacy system',
      order: 1,
      type: 'data_extraction',
      dependencies: [],
      execute: extractLegacyContracts,
      validate: validateContractExtraction,
      rollback: rollbackContractExtraction,
      estimatedDuration: 300,
      critical: true,
      retryable: true,
      maxRetries: 3,
      status: 'pending'
    },
    {
      id: 'transform-contracts',
      name: 'Transform Contracts to Subscriptions',
      description: 'Transform legacy contract data to subscription format',
      order: 2,
      type: 'data_transformation',
      dependencies: ['extract-legacy-contracts'],
      execute: transformContracts,
      validate: validateContractTransformation,
      estimatedDuration: 600,
      critical: true,
      retryable: false,
      maxRetries: 1,
      status: 'pending'
    },
    {
      id: 'load-subscriptions',
      name: 'Load Subscriptions',
      description: 'Insert transformed subscriptions into database',
      order: 3,
      type: 'data_loading',
      dependencies: ['transform-contracts'],
      execute: loadSubscriptions,
      validate: validateSubscriptionLoad,
      rollback: rollbackSubscriptionLoad,
      estimatedDuration: 900,
      critical: true,
      retryable: true,
      maxRetries: 2,
      status: 'pending'
    },
    {
      id: 'create-performance-obligations',
      name: 'Create Performance Obligations',
      description: 'Generate performance obligations from subscription items',
      order: 4,
      type: 'data_loading',
      dependencies: ['load-subscriptions'],
      execute: createPerformanceObligations,
      validate: validatePerformanceObligations,
      rollback: rollbackPerformanceObligations,
      estimatedDuration: 600,
      critical: true,
      retryable: false,
      maxRetries: 1,
      status: 'pending'
    }
  ];
}

/**
 * Extract legacy contracts from source system
 */
async function extractLegacyContracts(context: MigrationContext): Promise<StepResult> {
  const startTime = Date.now();
  const errors: MigrationError[] = [];
  const warnings: string[] = [];
  
  try {
    context.logger.info('Extracting legacy contracts');
    
    // In a real implementation, this would connect to the legacy database
    // For now, we'll simulate with sample data
    const legacyContracts = await fetchLegacyContracts(context);
    
    // Store in context for next steps
    context.metadata.legacyContracts = legacyContracts;
    
    // Log audit entry
    context.auditLog.log({
      timestamp: new Date(),
      action: 'extract',
      entityType: 'contract',
      entityId: 'batch',
      result: 'success',
      details: {
        count: legacyContracts.length,
        organizationId: context.organizationId
      }
    });
    
    return {
      success: true,
      recordsProcessed: legacyContracts.length,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors,
      warnings,
      duration: Date.now() - startTime,
      metadata: {
        contractCount: legacyContracts.length
      }
    };
    
  } catch (error) {
    context.logger.error('Failed to extract legacy contracts', error as Error);
    errors.push({
      code: 'EXTRACTION_FAILED',
      message: (error as Error).message,
      timestamp: new Date(),
      severity: 'critical'
    });
    
    return {
      success: false,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors,
      warnings,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Transform legacy contracts to subscription format
 */
async function transformContracts(context: MigrationContext): Promise<StepResult> {
  const startTime = Date.now();
  const errors: MigrationError[] = [];
  const warnings: string[] = [];
  
  try {
    const legacyContracts: LegacyContract[] = context.metadata.legacyContracts || [];
    context.logger.info(`Transforming ${legacyContracts.length} contracts`);
    
    const transformedSubscriptions: any[] = [];
    let failedCount = 0;
    
    for (const contract of legacyContracts) {
      try {
        const subscription = transformContract(contract);
        transformedSubscriptions.push(subscription);
        
        // Store mapping
        context.mappingStore.save('contract_subscription', contract.id, subscription.id);
        
      } catch (error) {
        failedCount++;
        errors.push({
          code: 'TRANSFORMATION_FAILED',
          message: `Failed to transform contract ${contract.id}: ${(error as Error).message}`,
          recordId: contract.id,
          timestamp: new Date(),
          severity: 'error'
        });
      }
    }
    
    // Store transformed data for next step
    context.metadata.transformedSubscriptions = transformedSubscriptions;
    
    return {
      success: failedCount === 0,
      recordsProcessed: legacyContracts.length,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: failedCount,
      errors,
      warnings,
      duration: Date.now() - startTime,
      metadata: {
        transformedCount: transformedSubscriptions.length,
        failedCount
      }
    };
    
  } catch (error) {
    context.logger.error('Contract transformation failed', error as Error);
    errors.push({
      code: 'TRANSFORMATION_FAILED',
      message: (error as Error).message,
      timestamp: new Date(),
      severity: 'critical'
    });
    
    return {
      success: false,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors,
      warnings,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Load subscriptions into database
 */
async function loadSubscriptions(context: MigrationContext): Promise<StepResult> {
  const startTime = Date.now();
  const errors: MigrationError[] = [];
  const warnings: string[] = [];
  
  try {
    const transformedSubscriptions = context.metadata.transformedSubscriptions || [];
    context.logger.info(`Loading ${transformedSubscriptions.length} subscriptions`);
    
    let createdCount = 0;
    let failedCount = 0;
    
    // Process in batches
    const batchSize = context.batchSize;
    for (let i = 0; i < transformedSubscriptions.length; i += batchSize) {
      const batch = transformedSubscriptions.slice(i, i + batchSize);
      
      try {
        if (!context.dryRun) {
          await context.database.transaction(async (tx: any) => {
            for (const subData of batch) {
              // Insert subscription
              const [subscription] = await tx
                .insert(subscriptions)
                .values(subData.subscription)
                .returning();
              
              // Insert subscription items
              if (subData.items && subData.items.length > 0) {
                await tx
                  .insert(subscriptionItems)
                  .values(subData.items);
              }
              
              createdCount++;
              
              // Log audit entry
              context.auditLog.log({
                timestamp: new Date(),
                action: 'create',
                entityType: 'subscription',
                entityId: subscription.id,
                legacyId: subData.legacyId,
                newId: subscription.id,
                result: 'success',
                details: {
                  subscriptionNumber: subscription.subscriptionNumber,
                  contractValue: subscription.contractValue
                }
              });
            }
          });
        } else {
          // Dry run - just count
          createdCount += batch.length;
        }
        
      } catch (error) {
        failedCount += batch.length;
        errors.push({
          code: 'LOAD_FAILED',
          message: `Failed to load batch: ${(error as Error).message}`,
          timestamp: new Date(),
          severity: 'error'
        });
      }
      
      // Update progress
      context.logger.progress(i + batch.length, transformedSubscriptions.length, 'Loading subscriptions');
    }
    
    return {
      success: failedCount === 0,
      recordsProcessed: transformedSubscriptions.length,
      recordsCreated: createdCount,
      recordsUpdated: 0,
      recordsFailed: failedCount,
      errors,
      warnings,
      duration: Date.now() - startTime,
      metadata: {
        createdCount,
        failedCount
      }
    };
    
  } catch (error) {
    context.logger.error('Subscription load failed', error as Error);
    errors.push({
      code: 'LOAD_FAILED',
      message: (error as Error).message,
      timestamp: new Date(),
      severity: 'critical'
    });
    
    return {
      success: false,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors,
      warnings,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Create performance obligations from subscription items
 */
async function createPerformanceObligations(context: MigrationContext): Promise<StepResult> {
  const startTime = Date.now();
  const errors: MigrationError[] = [];
  const warnings: string[] = [];
  
  try {
    context.logger.info('Creating performance obligations');
    
    if (context.dryRun) {
      return {
        success: true,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
        errors,
        warnings,
        duration: Date.now() - startTime,
        metadata: {
          message: 'Dry run - skipping performance obligation creation'
        }
      };
    }
    
    // Get all migrated subscriptions
    const subscriptionMappings = context.mappingStore.getAll('contract_subscription');
    let createdCount = 0;
    let failedCount = 0;
    
    for (const [legacyId, subscriptionId] of subscriptionMappings) {
      try {
        // Get subscription items
        const items = await context.database
          .select()
          .from(subscriptionItems)
          .where(eq(subscriptionItems.subscriptionId, subscriptionId));
        
        // Create performance obligations for each item
        for (const item of items) {
          const obligation: NewPerformanceObligation = {
            id: uuidv4(),
            organizationId: item.organizationId,
            subscriptionId,
            itemId: item.itemId,
            obligationType: determineObligationType(item),
            allocatedAmount: item.unitPrice, // Will be adjusted by SSP allocation
            satisfactionMethod: determineSatisfactionMethod(item),
            startDate: item.startDate,
            endDate: item.endDate,
            status: 'active' as const,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          await context.database
            .insert(performanceObligations)
            .values(obligation);
          
          createdCount++;
          
          // Store mapping
          context.mappingStore.save('performance_obligation', item.id, obligation.id);
        }
        
      } catch (error) {
        failedCount++;
        errors.push({
          code: 'PO_CREATION_FAILED',
          message: `Failed to create POs for subscription ${subscriptionId}: ${(error as Error).message}`,
          recordId: subscriptionId,
          timestamp: new Date(),
          severity: 'error'
        });
      }
    }
    
    return {
      success: failedCount === 0,
      recordsProcessed: subscriptionMappings.size,
      recordsCreated: createdCount,
      recordsUpdated: 0,
      recordsFailed: failedCount,
      errors,
      warnings,
      duration: Date.now() - startTime,
      metadata: {
        obligationsCreated: createdCount
      }
    };
    
  } catch (error) {
    context.logger.error('Performance obligation creation failed', error as Error);
    errors.push({
      code: 'PO_CREATION_FAILED',
      message: (error as Error).message,
      timestamp: new Date(),
      severity: 'critical'
    });
    
    return {
      success: false,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors,
      warnings,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Helper Functions
 */

function transformContract(contract: LegacyContract): any {
  const subscriptionId = uuidv4();
  
  // Map contract status to subscription status
  const statusMap: Record<string, string> = {
    'draft': 'draft',
    'signed': 'active',
    'active': 'active',
    'terminated': 'cancelled',
    'expired': 'expired'
  };
  
  const subscription: NewSubscription = {
    id: subscriptionId,
    organizationId: contract.organizationId,
    entityId: contract.customerId,
    subscriptionNumber: contract.contractNumber,
    status: (statusMap[contract.status] || 'draft') as "active" | "draft" | "suspended" | "cancelled" | "expired",
    startDate: contract.startDate,
    endDate: contract.endDate,
    contractValue: contract.totalValue.toString(),
    billingFrequency: (contract.billingFrequency || 'annual') as "custom" | "monthly" | "quarterly" | "semi_annual" | "annual",
    autoRenew: false,
    metadata: {
      legacyContractId: contract.id,
      migrationDate: new Date().toISOString(),
      ...contract.metadata
    },
    createdAt: new Date(contract.createdAt),
    updatedAt: new Date(contract.updatedAt)
  };
  
  // Transform line items
  const items: NewSubscriptionItem[] = contract.lineItems.map(lineItem => ({
    id: uuidv4(),
    organizationId: contract.organizationId,
    subscriptionId,
    itemId: lineItem.itemId,
    quantity: lineItem.quantity.toString(),
    unitPrice: lineItem.unitPrice.toString(),
    startDate: lineItem.startDate || contract.startDate,
    endDate: lineItem.endDate || contract.endDate,
    metadata: {
      legacyLineItemId: lineItem.id,
      ...lineItem.metadata
    },
    createdAt: new Date(contract.createdAt),
    updatedAt: new Date(contract.updatedAt)
  }));
  
  return {
    subscription,
    items,
    legacyId: contract.id
  };
}

function determineObligationType(item: any): "professional_services" | "other" | "product_license" | "maintenance_support" | "hosting_services" {
  // Logic to determine obligation type based on item properties
  // This would be customized based on business rules
  if (item.metadata?.itemType === 'license') {
    return 'product_license';
  } else if (item.metadata?.itemType === 'maintenance') {
    return 'maintenance_support';
  } else if (item.metadata?.itemType === 'service') {
    return 'professional_services';
  }
  return 'other';
}

function determineSatisfactionMethod(item: any): 'point_in_time' | 'over_time' {
  // Logic to determine satisfaction method
  if (item.metadata?.recognitionPattern === 'immediate') {
    return 'point_in_time';
  }
  // Note: 'milestone' is not a valid satisfaction method in the schema
  // Treating milestone as over_time recognition
  return 'over_time';
}

async function fetchLegacyContracts(context: MigrationContext): Promise<LegacyContract[]> {
  // In a real implementation, this would connect to the legacy database
  // For now, return sample data
  return [
    {
      id: 'legacy-contract-1',
      organizationId: context.organizationId,
      customerId: 'customer-1',
      contractNumber: 'CONTRACT-001',
      contractDate: '2023-01-01',
      startDate: '2023-01-01',
      endDate: '2023-12-31',
      totalValue: 120000,
      status: 'active',
      lineItems: [
        {
          id: 'legacy-line-1',
          contractId: 'legacy-contract-1',
          itemId: 'item-1',
          itemNumber: 'SKU-001',
          description: 'Software License',
          quantity: 1,
          unitPrice: 100000,
          totalPrice: 100000,
          recognitionPattern: 'immediate'
        },
        {
          id: 'legacy-line-2',
          contractId: 'legacy-contract-1',
          itemId: 'item-2',
          itemNumber: 'SKU-002',
          description: 'Annual Support',
          quantity: 1,
          unitPrice: 20000,
          totalPrice: 20000,
          recognitionPattern: 'ratable'
        }
      ],
      billingFrequency: 'annual',
      paymentTerms: 'net_30',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    }
  ];
}

/**
 * Validation Functions
 */

async function validateContractExtraction(context: MigrationContext): Promise<ValidationResult> {
  const contracts = context.metadata.legacyContracts || [];
  
  if (contracts.length === 0) {
    return {
      passed: false,
      checkName: 'Contract Extraction',
      message: 'No contracts extracted',
      discrepancies: []
    };
  }
  
  return {
    passed: true,
    checkName: 'Contract Extraction',
    message: `Successfully extracted ${contracts.length} contracts`,
    discrepancies: []
  };
}

async function validateContractTransformation(context: MigrationContext): Promise<ValidationResult> {
  const transformed = context.metadata.transformedSubscriptions || [];
  const original = context.metadata.legacyContracts || [];
  
  if (transformed.length !== original.length) {
    return {
      passed: false,
      checkName: 'Contract Transformation',
      expected: original.length,
      actual: transformed.length,
      message: 'Not all contracts were transformed',
      discrepancies: []
    };
  }
  
  return {
    passed: true,
    checkName: 'Contract Transformation',
    message: `Successfully transformed ${transformed.length} contracts`,
    discrepancies: []
  };
}

async function validateSubscriptionLoad(context: MigrationContext): Promise<ValidationResult> {
  if (context.dryRun) {
    return {
      passed: true,
      checkName: 'Subscription Load',
      message: 'Dry run - validation skipped',
      discrepancies: []
    };
  }
  
  const mappings = context.mappingStore.getAll('contract_subscription');
  
  // Verify subscriptions exist in database
  for (const [legacyId, subscriptionId] of mappings) {
    const exists = await context.database
      .select({ count: sql`count(*)` })
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId));
    
    if (exists[0].count === 0) {
      return {
        passed: false,
        checkName: 'Subscription Load',
        message: `Subscription ${subscriptionId} not found in database`,
        discrepancies: [{
          field: 'subscription',
          legacyValue: legacyId,
          migratedValue: subscriptionId,
          recordId: subscriptionId,
          severity: 'critical'
        }]
      };
    }
  }
  
  return {
    passed: true,
    checkName: 'Subscription Load',
    message: `All ${mappings.size} subscriptions loaded successfully`,
    discrepancies: []
  };
}

async function validatePerformanceObligations(context: MigrationContext): Promise<ValidationResult> {
  if (context.dryRun) {
    return {
      passed: true,
      checkName: 'Performance Obligations',
      message: 'Dry run - validation skipped',
      discrepancies: []
    };
  }
  
  const subscriptionMappings = context.mappingStore.getAll('contract_subscription');
  
  for (const [_, subscriptionId] of subscriptionMappings) {
    const obligations = await context.database
      .select({ count: sql`count(*)` })
      .from(performanceObligations)
      .where(eq(performanceObligations.subscriptionId, subscriptionId));
    
    if (obligations[0].count === 0) {
      return {
        passed: false,
        checkName: 'Performance Obligations',
        message: `No performance obligations found for subscription ${subscriptionId}`,
        discrepancies: []
      };
    }
  }
  
  return {
    passed: true,
    checkName: 'Performance Obligations',
    message: 'Performance obligations created successfully',
    discrepancies: []
  };
}

/**
 * Rollback Functions
 */

async function rollbackContractExtraction(context: MigrationContext): Promise<void> {
  context.logger.info('Rolling back contract extraction');
  delete context.metadata.legacyContracts;
}

async function rollbackSubscriptionLoad(context: MigrationContext): Promise<void> {
  context.logger.info('Rolling back subscription load');
  
  if (context.dryRun) return;
  
  const mappings = context.mappingStore.getAll('contract_subscription');
  
  for (const [_, subscriptionId] of mappings) {
    try {
      await context.database
        .delete(subscriptionItems)
        .where(eq(subscriptionItems.subscriptionId, subscriptionId));
      
      await context.database
        .delete(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    } catch (error) {
      context.logger.error(`Failed to rollback subscription ${subscriptionId}`, error as Error);
    }
  }
}

async function rollbackPerformanceObligations(context: MigrationContext): Promise<void> {
  context.logger.info('Rolling back performance obligations');
  
  if (context.dryRun) return;
  
  const mappings = context.mappingStore.getAll('performance_obligation');
  
  for (const [_, obligationId] of mappings) {
    try {
      await context.database
        .delete(performanceObligations)
        .where(eq(performanceObligations.id, obligationId));
    } catch (error) {
      context.logger.error(`Failed to rollback obligation ${obligationId}`, error as Error);
    }
  }
}