import { BaseService } from './base-service';
import { ServiceContext, ServiceError, PaginatedResult } from '../types';
import {
  SubscriptionRepository,
  SubscriptionItemRepository,
  SubscriptionVersionRepository,
  type Subscription,
  type NewSubscription,
  type UpdateSubscription,
  type SubscriptionItem,
  type NewSubscriptionItem,
  type SubscriptionWithItems as RepoSubscriptionWithItems,
  type SubscriptionVersion,
  type NewSubscriptionVersion,
  type ContextualDatabase,
} from '@glapi/database';

export interface SubscriptionServiceOptions {
  db?: ContextualDatabase;
}

// Valid subscription status transitions
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  'draft': ['active', 'cancelled'],
  'active': ['suspended', 'cancelled', 'expired'],
  'suspended': ['active', 'cancelled'],
  'cancelled': [], // Terminal state
  'expired': [], // Terminal state
};

export interface CreateSubscriptionData extends Omit<NewSubscription, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> {
  organizationId?: string;
  items?: Array<{
    itemId: string;
    quantity: string | number;
    unitPrice: string | number;
    discountPercentage?: string | number;
    startDate: Date | string;
    endDate?: Date | string | null;
    metadata?: Record<string, unknown>;
  }>;
}

export interface UpdateSubscriptionData extends Partial<UpdateSubscription> {
  items?: Array<{
    id?: string;
    itemId: string;
    quantity: string | number;
    unitPrice: string | number;
    discountPercentage?: string | number;
    startDate: Date | string;
    endDate?: Date | string | null;
    metadata?: Record<string, unknown>;
  }>;
  changeReason?: string;
  metadata?: Record<string, unknown>;
}

export interface ListSubscriptionsInput {
  entityId?: string;
  status?: 'draft' | 'active' | 'suspended' | 'cancelled' | 'expired';
  page?: number;
  limit?: number;
}

export interface AmendSubscriptionInput {
  subscriptionId: string;
  changes: UpdateSubscriptionData;
  effectiveDate: Date;
  reason: string;
}

// Use the repo's SubscriptionWithItems type
export type SubscriptionWithItems = RepoSubscriptionWithItems;

export class SubscriptionService extends BaseService {
  private subscriptionRepository: SubscriptionRepository;
  private subscriptionItemRepository: SubscriptionItemRepository;
  private subscriptionVersionRepository: SubscriptionVersionRepository;

  constructor(context: ServiceContext = {}, options: SubscriptionServiceOptions = {}) {
    super(context);
    // Pass the contextual db to all repositories for RLS support
    this.subscriptionRepository = new SubscriptionRepository(options.db);
    this.subscriptionItemRepository = new SubscriptionItemRepository(options.db);
    this.subscriptionVersionRepository = new SubscriptionVersionRepository(options.db);
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  async listSubscriptions(input: ListSubscriptionsInput = {}): Promise<PaginatedResult<Subscription>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(input);

    const result = await this.subscriptionRepository.list({
      organizationId,
      entityId: input.entityId,
      status: input.status,
      limit: take,
      offset: skip
    });

    return this.createPaginatedResult(result.data, result.total, page, limit);
  }

  async getSubscriptionById(id: string): Promise<SubscriptionWithItems | null> {
    const organizationId = this.requireOrganizationContext();

    const subscription = await this.subscriptionRepository.findByIdWithItems(id);
    if (!subscription || subscription.organizationId !== organizationId) {
      return null;
    }

    return subscription;
  }

  async getSubscriptionByNumber(subscriptionNumber: string): Promise<SubscriptionWithItems | null> {
    const organizationId = this.requireOrganizationContext();

    // Repository signature is (organizationId, subscriptionNumber)
    const subscription = await this.subscriptionRepository.findByNumber(organizationId, subscriptionNumber);
    if (!subscription) {
      return null;
    }

    return await this.subscriptionRepository.findByIdWithItems(subscription.id);
  }

  // ============================================================================
  // Version History Methods
  // ============================================================================

  async getVersionHistory(
    subscriptionId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<PaginatedResult<SubscriptionVersion>> {
    const organizationId = this.requireOrganizationContext();
    const subscription = await this.subscriptionRepository.findByIdWithItems(subscriptionId);

    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }

    const { skip, take, page, limit } = this.getPaginationParams(options);
    const result = await this.subscriptionVersionRepository.getVersionHistory(subscriptionId, {
      limit: take,
      offset: skip,
    });

    return this.createPaginatedResult(result.data, result.total, page, limit);
  }

  async getVersion(subscriptionId: string, versionNumber: number): Promise<SubscriptionVersion | null> {
    const organizationId = this.requireOrganizationContext();
    const subscription = await this.subscriptionRepository.findByIdWithItems(subscriptionId);

    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }

    return this.subscriptionVersionRepository.findBySubscriptionAndVersion(subscriptionId, versionNumber);
  }

  // ============================================================================
  // Create Methods
  // ============================================================================

  async createSubscription(data: CreateSubscriptionData): Promise<SubscriptionWithItems> {
    const organizationId = this.requireOrganizationContext();

    // Generate subscription number if not provided
    const subscriptionNumber = data.subscriptionNumber || await this.generateSubscriptionNumber();

    // Create subscription with items using the createWithItems method
    const { items, ...subscriptionData } = data;

    // Convert dates to strings if needed
    const subscriptionToCreate = {
      ...subscriptionData,
      subscriptionNumber,
      organizationId,
      status: data.status || 'draft',
      startDate: typeof data.startDate === 'string' ? data.startDate : (data.startDate as Date).toISOString().split('T')[0],
      endDate: data.endDate ? (typeof data.endDate === 'string' ? data.endDate : (data.endDate as Date).toISOString().split('T')[0]) : undefined
    } as NewSubscription;

    // Convert items data
    const itemsToCreate = items?.map(item => ({
      itemId: item.itemId,
      organizationId,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      discountPercentage: item.discountPercentage ? String(item.discountPercentage) : undefined,
      startDate: typeof item.startDate === 'string' ? item.startDate : item.startDate.toISOString().split('T')[0],
      endDate: item.endDate ? (typeof item.endDate === 'string' ? item.endDate : item.endDate.toISOString().split('T')[0]) : undefined,
      metadata: item.metadata
    })) || [];

    const subscription = await this.subscriptionRepository.createWithItems(subscriptionToCreate, itemsToCreate);

    // Record initial version
    await this.recordVersion(subscription, null, 'creation', 'Subscription created');

    return subscription;
  }

  // ============================================================================
  // Update Methods
  // ============================================================================

  async updateSubscription(id: string, data: UpdateSubscriptionData): Promise<SubscriptionWithItems | null> {
    const organizationId = this.requireOrganizationContext();

    const existingSubscription = await this.subscriptionRepository.findByIdWithItems(id);
    if (!existingSubscription || existingSubscription.organizationId !== organizationId) {
      return null;
    }

    // Check if subscription can be modified
    if (existingSubscription.status === 'cancelled' || existingSubscription.status === 'expired') {
      throw new ServiceError(
        `Cannot modify ${existingSubscription.status} subscription`,
        'INVALID_STATE',
        400
      );
    }

    // Track changes for versioning
    const changedFields = this.detectChangedFields(existingSubscription, data);

    // Update subscription
    const { items, changeReason, ...subscriptionData } = data;
    const updatedSubscription = await this.subscriptionRepository.update(id, subscriptionData);

    if (!updatedSubscription) {
      return null;
    }

    // Handle items update if provided
    let currentItems = existingSubscription.items || [];

    if (items) {
      // Delete existing items and create new ones
      if (currentItems.length > 0) {
        await Promise.all(
          currentItems.map(item => this.subscriptionItemRepository.delete(item.id))
        );
      }

      const itemsToCreate = items.map(item => ({
        itemId: item.itemId,
        subscriptionId: id,
        organizationId,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        discountPercentage: item.discountPercentage ? String(item.discountPercentage) : undefined,
        startDate: typeof item.startDate === 'string' ? item.startDate : item.startDate.toISOString().split('T')[0],
        endDate: item.endDate ? (typeof item.endDate === 'string' ? item.endDate : item.endDate.toISOString().split('T')[0]) : undefined,
        metadata: item.metadata
      }));

      currentItems = await Promise.all(
        itemsToCreate.map(item => this.subscriptionItemRepository.create(item as NewSubscriptionItem))
      );

      changedFields.push({ field: 'items', oldValue: existingSubscription.items, newValue: items });
    }

    const result = {
      ...updatedSubscription,
      items: currentItems as any
    };

    // Record version for the amendment
    if (changedFields.length > 0) {
      await this.recordVersion(
        result,
        existingSubscription,
        items ? 'modification' : 'amendment',
        changeReason || 'Subscription updated',
        changedFields
      );
    }

    return result;
  }

  // ============================================================================
  // Lifecycle State Transitions
  // ============================================================================

  async activateSubscription(subscriptionId: string): Promise<SubscriptionWithItems> {
    return this.transitionStatus(subscriptionId, 'active', {
      validateFn: (subscription) => {
        const items = subscription.items || [];
        if (!items || items.length === 0) {
          throw new ServiceError(
            'Subscription must have at least one item to be activated',
            'MISSING_ITEMS',
            400
          );
        }
      },
      reason: 'Subscription activated',
      versionType: 'activation',
    });
  }

  async suspendSubscription(subscriptionId: string, reason?: string): Promise<SubscriptionWithItems> {
    return this.transitionStatus(subscriptionId, 'suspended', {
      reason: reason || 'Subscription suspended',
      metadata: { suspensionReason: reason },
      versionType: 'suspension'
    });
  }

  async resumeSubscription(subscriptionId: string): Promise<SubscriptionWithItems> {
    const result = await this.transitionStatus(subscriptionId, 'active', {
      reason: 'Subscription resumed from suspension',
      versionType: 'resumption'
    });
    return result;
  }

  async cancelSubscription(
    subscriptionId: string,
    cancellationDate: Date,
    reason?: string
  ): Promise<SubscriptionWithItems> {
    return this.transitionStatus(subscriptionId, 'cancelled', {
      reason: reason || 'Subscription cancelled',
      additionalUpdates: {
        endDate: cancellationDate.toISOString().split('T')[0],
      },
      metadata: {
        cancellationReason: reason,
        cancellationDate: cancellationDate.toISOString()
      },
      versionType: 'cancellation'
    });
  }

  async renewSubscription(
    subscriptionId: string,
    renewalTermMonths: number,
    newEndDate: Date
  ): Promise<SubscriptionWithItems> {
    const organizationId = this.requireOrganizationContext();
    const subscription = await this.subscriptionRepository.findByIdWithItems(subscriptionId);

    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }

    if (subscription.status !== 'active' && subscription.status !== 'expired') {
      throw new ServiceError(
        'Only active or expired subscriptions can be renewed',
        'INVALID_STATE_TRANSITION',
        400
      );
    }

    const previousStatus = subscription.status;
    const updatedSubscription = await this.subscriptionRepository.update(subscriptionId, {
      status: 'active',
      endDate: newEndDate.toISOString().split('T')[0],
      renewalTermMonths,
      metadata: {
        ...(subscription.metadata as any || {}),
        lastRenewedAt: new Date().toISOString(),
        previousEndDate: subscription.endDate
      }
    });

    if (!updatedSubscription) {
      throw new ServiceError('Failed to renew subscription', 'UPDATE_FAILED', 500);
    }

    const result = {
      ...updatedSubscription,
      items: subscription.items || []
    } as SubscriptionWithItems;

    await this.recordVersion(
      result,
      subscription,
      'renewal',
      `Subscription renewed for ${renewalTermMonths} months`,
      [
        { field: 'status', oldValue: previousStatus, newValue: 'active' },
        { field: 'endDate', oldValue: subscription.endDate, newValue: newEndDate.toISOString().split('T')[0] },
        { field: 'renewalTermMonths', oldValue: subscription.renewalTermMonths, newValue: renewalTermMonths }
      ]
    );

    return result;
  }

  // ============================================================================
  // Amendment (Contract Modification)
  // ============================================================================

  async amendSubscription(input: AmendSubscriptionInput): Promise<SubscriptionWithItems> {
    const { subscriptionId, changes, effectiveDate, reason } = input;
    const organizationId = this.requireOrganizationContext();

    const subscription = await this.subscriptionRepository.findByIdWithItems(subscriptionId);
    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }

    if (subscription.status !== 'active') {
      throw new ServiceError(
        'Only active subscriptions can be amended',
        'INVALID_STATE',
        400
      );
    }

    // Apply amendments
    const result = await this.updateSubscription(subscriptionId, {
      ...changes,
      changeReason: reason,
      metadata: {
        ...(subscription.metadata as any || {}),
        lastAmendmentDate: effectiveDate.toISOString(),
        amendmentReason: reason
      }
    });

    return result!;
  }

  // ============================================================================
  // Revenue Integration (Placeholder for crk.3)
  // ============================================================================

  async calculateRevenue(
    subscriptionId: string,
    calculationType: 'initial' | 'modification' | 'renewal',
    effectiveDate: Date
  ): Promise<any> {
    const organizationId = this.requireOrganizationContext();

    const subscription = await this.getSubscriptionById(subscriptionId);
    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }

    // TODO: Implement revenue calculation engine integration (crk.3)

    return {
      subscriptionId,
      calculationType,
      effectiveDate,
      message: 'Revenue calculation will be implemented in crk.3'
    };
  }

  async getRevenueSchedule(subscriptionId: string): Promise<any> {
    const organizationId = this.requireOrganizationContext();

    const subscription = await this.subscriptionRepository.findByIdWithItems(subscriptionId);
    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }

    // TODO: Fetch revenue schedules (crk.3)

    return {
      subscriptionId,
      schedules: [],
      message: 'Revenue schedule retrieval will be implemented in crk.3'
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async transitionStatus(
    subscriptionId: string,
    newStatus: string,
    options: {
      validateFn?: (subscription: SubscriptionWithItems) => void;
      reason?: string;
      additionalUpdates?: Partial<UpdateSubscription>;
      metadata?: Record<string, unknown>;
      versionType?: NewSubscriptionVersion['versionType'];
    } = {}
  ): Promise<SubscriptionWithItems> {
    const organizationId = this.requireOrganizationContext();

    const subscription = await this.subscriptionRepository.findByIdWithItems(subscriptionId);
    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }

    // Validate transition is allowed
    const allowedTransitions = VALID_STATUS_TRANSITIONS[subscription.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new ServiceError(
        `Cannot transition from ${subscription.status} to ${newStatus}`,
        'INVALID_STATE_TRANSITION',
        400
      );
    }

    // Run custom validation if provided
    if (options.validateFn) {
      options.validateFn(subscription);
    }

    const previousStatus = subscription.status;

    // Update subscription
    const updatedSubscription = await this.subscriptionRepository.update(subscriptionId, {
      status: newStatus as any,
      ...options.additionalUpdates,
      metadata: {
        ...(subscription.metadata as any || {}),
        ...options.metadata
      }
    });

    if (!updatedSubscription) {
      throw new ServiceError(`Failed to update subscription to ${newStatus}`, 'UPDATE_FAILED', 500);
    }

    const result = {
      ...updatedSubscription,
      items: subscription.items || []
    } as SubscriptionWithItems;

    // Record version
    const inferredVersionType: NewSubscriptionVersion['versionType'] =
      options.versionType ||
      (newStatus === 'active' && previousStatus === 'draft' ? 'activation'
        : newStatus === 'suspended' ? 'suspension'
          : newStatus === 'active' && previousStatus === 'suspended' ? 'resumption'
            : newStatus === 'cancelled' ? 'cancellation'
              : 'modification');

    await this.recordVersion(
      result,
      subscription,
      inferredVersionType,
      options.reason || `Status changed to ${newStatus}`,
      [{ field: 'status', oldValue: previousStatus, newValue: newStatus }]
    );

    return result;
  }

  private async recordVersion(
    subscription: SubscriptionWithItems,
    previousSubscription: SubscriptionWithItems | null,
    versionType: NewSubscriptionVersion['versionType'],
    changeSummary: string,
    changedFields?: Array<{ field: string; oldValue: unknown; newValue: unknown }>
  ): Promise<SubscriptionVersion> {
    const organizationId = this.requireOrganizationContext();

    const snapshot = this.createSnapshot(subscription);
    const itemsSnapshot = (subscription.items || []).map(item => ({
      id: item.id,
      itemId: item.itemId,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      discountPercentage: item.discountPercentage ? String(item.discountPercentage) : null,
      startDate: item.startDate,
      endDate: item.endDate || null,
    }));

    return this.subscriptionVersionRepository.recordVersion({
      organizationId,
      subscriptionId: subscription.id,
      versionType,
      versionSource: 'user',
      subscriptionSnapshot: snapshot,
      itemsSnapshot,
      changeSummary,
      changeReason: undefined,
      effectiveDate: new Date(),
      // Do not set createdBy by default: the live schema FK's to `users(id)` and
      // many callers use entity UUIDs or API keys instead of user UUIDs.
      createdBy: undefined,
      metadata: {
        previousStatus: previousSubscription?.status,
        newStatus: subscription.status,
        changedFields,
        previousContractValue: previousSubscription?.contractValue || undefined,
        newContractValue: subscription.contractValue || undefined,
      },
    });
  }

  private createSnapshot(subscription: SubscriptionWithItems): Record<string, unknown> {
    return {
      id: subscription.id,
      subscriptionNumber: subscription.subscriptionNumber,
      status: subscription.status,
      entityId: subscription.entityId,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      contractValue: subscription.contractValue,
      billingFrequency: subscription.billingFrequency,
      autoRenew: subscription.autoRenew,
      renewalTermMonths: subscription.renewalTermMonths,
      metadata: subscription.metadata,
    };
  }

  private detectChangedFields(
    existing: SubscriptionWithItems,
    updates: UpdateSubscriptionData
  ): Array<{ field: string; oldValue: unknown; newValue: unknown }> {
    const changedFields: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

    const fieldsToCheck = ['status', 'startDate', 'endDate', 'contractValue', 'billingFrequency', 'autoRenew', 'renewalTermMonths'];

    for (const field of fieldsToCheck) {
      if (field in updates && (existing as any)[field] !== (updates as any)[field]) {
        changedFields.push({
          field,
          oldValue: (existing as any)[field],
          newValue: (updates as any)[field]
        });
      }
    }

    return changedFields;
  }

  private async generateSubscriptionNumber(): Promise<string> {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `SUB-${timestamp}-${random}`;
  }
}

// Factory function for creating service instance
export function createSubscriptionService(
  organizationId?: string,
  userId?: string
): SubscriptionService {
  return new SubscriptionService({ organizationId, userId });
}
