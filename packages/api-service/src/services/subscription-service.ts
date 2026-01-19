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
  type UpdateSubscriptionItem,
  type SubscriptionWithItems as RepoSubscriptionWithItems,
  type SubscriptionVersion,
  type SubscriptionVersionTypeValue,
  type SubscriptionVersionSourceValue,
} from '@glapi/database';

export interface CreateSubscriptionData extends Omit<NewSubscription, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> {
  organizationId?: string;
  items?: Array<{
    itemId: string;
    quantity: string | number;
    unitPrice: string | number;
    discountPercentage?: string | number;
    startDate: Date | string;
    endDate?: Date | string | null;
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
  }>;
}

export interface AmendmentItemInput {
  id?: string;
  itemId: string;
  quantity?: string | number;
  unitPrice?: string | number;
  discountPercentage?: string | number;
  startDate?: Date | string;
  endDate?: Date | string | null;
}

export interface AmendSubscriptionInput {
  subscriptionId: string;
  subscriptionData?: UpdateSubscriptionData;
  addItems?: AmendmentItemInput[];
  updateItems?: AmendmentItemInput[];
  removeItemIds?: string[];
  reason?: string;
  effectiveDate?: Date | string;
  metadata?: Record<string, any>;
  modificationId?: string;
}

export interface ListSubscriptionsInput {
  entityId?: string;
  status?: 'draft' | 'active' | 'suspended' | 'cancelled';
  page?: number;
  limit?: number;
}

// Use the repo's SubscriptionWithItems type
export type SubscriptionWithItems = RepoSubscriptionWithItems;

export class SubscriptionService extends BaseService {
  private subscriptionRepository: SubscriptionRepository;
  private subscriptionItemRepository: SubscriptionItemRepository;
  private subscriptionVersionRepository: SubscriptionVersionRepository;

  constructor(context: ServiceContext = {}) {
    super(context);
    this.subscriptionRepository = new SubscriptionRepository();
    this.subscriptionItemRepository = new SubscriptionItemRepository();
    this.subscriptionVersionRepository = new SubscriptionVersionRepository();
  }

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
      endDate: item.endDate ? (typeof item.endDate === 'string' ? item.endDate : item.endDate.toISOString().split('T')[0]) : undefined
    })) || [];

    const createdSubscription = await this.subscriptionRepository.createWithItems(subscriptionToCreate, itemsToCreate);
    await this.recordVersionSnapshot(
      createdSubscription,
      'creation',
      'Initial subscription created'
    );

    return createdSubscription;
  }

  async updateSubscription(id: string, data: UpdateSubscriptionData): Promise<SubscriptionWithItems | null> {
    const organizationId = this.requireOrganizationContext();
    
    const existingSubscription = await this.subscriptionRepository.findByIdWithItems(id);
    if (!existingSubscription || existingSubscription.organizationId !== organizationId) {
      return null;
    }

    // Update subscription
    const { items, ...subscriptionData } = data;
    const updatedSubscription = await this.subscriptionRepository.update(id, subscriptionData);
    
    if (!updatedSubscription) {
      return null;
    }

    // Handle items update if provided
    let currentItems = existingSubscription.items || [];
    
    if (items) {
      // Delete existing items and create new ones
      // In production, you might want to update existing items instead
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
        endDate: item.endDate ? (typeof item.endDate === 'string' ? item.endDate : item.endDate.toISOString().split('T')[0]) : undefined
      }));
      
      currentItems = await Promise.all(
        itemsToCreate.map(item => this.subscriptionItemRepository.create(item as NewSubscriptionItem))
      );
    }

    const summaryParts: string[] = [];
    if (Object.keys(subscriptionData).length > 0) {
      summaryParts.push(`Fields: ${Object.keys(subscriptionData).join(', ')}`);
    }
    if (items) {
      summaryParts.push(`Items replaced (${items.length})`);
    }

    const finalSubscription: SubscriptionWithItems = {
      ...updatedSubscription,
      items: currentItems as any
    };

    await this.recordVersionSnapshot(
      finalSubscription,
      'modification',
      summaryParts.length > 0 ? `Updated ${summaryParts.join('; ')}` : 'Subscription updated'
    );

    return finalSubscription;
  }

  async activateSubscription(subscriptionId: string): Promise<SubscriptionWithItems> {
    const organizationId = this.requireOrganizationContext();
    
    const subscription = await this.subscriptionRepository.findByIdWithItems(subscriptionId);
    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }

    if (subscription.status !== 'draft') {
      throw new ServiceError(
        'Only draft subscriptions can be activated',
        'INVALID_STATE_TRANSITION',
        400
      );
    }

    // Validate required fields
    const items = subscription.items || [];
    if (!items || items.length === 0) {
      throw new ServiceError(
        'Subscription must have at least one item to be activated',
        'MISSING_ITEMS',
        400
      );
    }

    // Update status to active
    const updatedSubscription = await this.subscriptionRepository.update(subscriptionId, {
      status: 'active'
    });

    if (!updatedSubscription) {
      throw new ServiceError('Failed to activate subscription', 'UPDATE_FAILED', 500);
    }

    // TODO: Trigger revenue calculation

    const activatedSubscription: SubscriptionWithItems = {
      ...updatedSubscription,
      items
    };

    await this.recordVersionSnapshot(
      activatedSubscription,
      'activation',
      'Subscription activated'
    );

    return activatedSubscription;
  }

  async cancelSubscription(
    subscriptionId: string, 
    cancellationDate: Date, 
    reason?: string
  ): Promise<SubscriptionWithItems> {
    const organizationId = this.requireOrganizationContext();
    
    const subscription = await this.subscriptionRepository.findByIdWithItems(subscriptionId);
    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }

    if (subscription.status === 'cancelled') {
      throw new ServiceError('Subscription is already cancelled', 'ALREADY_CANCELLED', 400);
    }

    // Update status to cancelled
    const updatedSubscription = await this.subscriptionRepository.update(subscriptionId, {
      status: 'cancelled',
      endDate: cancellationDate.toISOString().split('T')[0],
      metadata: {
        ...(subscription.metadata as any || {}),
        cancellationReason: reason,
        cancellationDate: cancellationDate.toISOString()
      }
    });

    if (!updatedSubscription) {
      throw new ServiceError('Failed to cancel subscription', 'UPDATE_FAILED', 500);
    }

    const cancelledSubscription: SubscriptionWithItems = {
      ...updatedSubscription,
      items: subscription.items || []
    };

    await this.recordVersionSnapshot(
      cancelledSubscription,
      'cancellation',
      'Subscription cancelled',
      {
        reason,
        metadata: {
          cancellationDate: cancellationDate.toISOString(),
          ...((subscription.metadata as any) || {})
        }
      }
    );

    return cancelledSubscription;
  }

  async amendSubscription(input: AmendSubscriptionInput): Promise<SubscriptionWithItems> {
    const organizationId = this.requireOrganizationContext();
    this.requireUserContext();

    const hasChanges =
      (input.subscriptionData && Object.keys(input.subscriptionData).length > 0) ||
      (input.addItems && input.addItems.length > 0) ||
      (input.updateItems && input.updateItems.length > 0) ||
      (input.removeItemIds && input.removeItemIds.length > 0);

    if (!hasChanges) {
      throw new ServiceError('No amendment changes provided', 'NO_CHANGES', 400);
    }

    const subscription = await this.subscriptionRepository.findByIdWithItems(input.subscriptionId);
    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }

    const summaryParts: string[] = [];
    const metadata: Record<string, any> = {
      ...input.metadata,
      amendment: {
        reason: input.reason,
      }
    };

    if (input.subscriptionData && Object.keys(input.subscriptionData).length > 0) {
      const normalized = this.normalizeSubscriptionUpdate(input.subscriptionData);
      await this.subscriptionRepository.update(input.subscriptionId, normalized);
      summaryParts.push(`Fields: ${Object.keys(normalized).join(', ')}`);
      metadata.amendment.fields = Object.keys(normalized);
    }

    let addedCount = 0;
    if (input.addItems && input.addItems.length > 0) {
      const itemsToCreate = input.addItems.map(item =>
        this.normalizeItemInput(item, organizationId, subscription.id, subscription.startDate)
      );
      await Promise.all(
        itemsToCreate.map(item =>
          this.subscriptionItemRepository.create(item as NewSubscriptionItem)
        )
      );
      addedCount = itemsToCreate.length;
      summaryParts.push(`Added ${addedCount} item(s)`);
      metadata.amendment.added = addedCount;
    }

    let updatedCount = 0;
    if (input.updateItems && input.updateItems.length > 0) {
      for (const item of input.updateItems) {
        if (!item.id) {
          continue;
        }
        const updatePayload: UpdateSubscriptionItem = {};
        if (item.quantity !== undefined) {
          updatePayload.quantity = String(item.quantity);
        }
        if (item.unitPrice !== undefined) {
          updatePayload.unitPrice = String(item.unitPrice);
        }
        if (item.discountPercentage !== undefined) {
          updatePayload.discountPercentage = item.discountPercentage !== null
            ? String(item.discountPercentage)
            : undefined;
        }
        if (item.startDate) {
          updatePayload.startDate = this.coerceDateString(item.startDate);
        }
        if (item.endDate !== undefined) {
          updatePayload.endDate = item.endDate
            ? this.coerceDateString(item.endDate)
            : undefined;
        }

        if (Object.keys(updatePayload).length > 0) {
          await this.subscriptionItemRepository.update(item.id, updatePayload);
          updatedCount += 1;
        }
      }

      if (updatedCount > 0) {
        summaryParts.push(`Updated ${updatedCount} item(s)`);
        metadata.amendment.updated = updatedCount;
      }
    }

    let removedCount = 0;
    if (input.removeItemIds && input.removeItemIds.length > 0) {
      await Promise.all(
        input.removeItemIds.map(id => this.subscriptionItemRepository.delete(id))
      );
      removedCount = input.removeItemIds.length;
      summaryParts.push(`Removed ${removedCount} item(s)`);
      metadata.amendment.removed = removedCount;
    }

    // Recalculate contract value if line items changed
    if (addedCount > 0 || updatedCount > 0 || removedCount > 0) {
      const newValue = await this.subscriptionRepository.calculateContractValue(input.subscriptionId);
      await this.subscriptionRepository.update(input.subscriptionId, {
        contractValue: String(newValue)
      });
    }

    const latest = await this.subscriptionRepository.findByIdWithItems(input.subscriptionId);
    if (!latest) {
      throw new ServiceError('Subscription not found after amendment', 'NOT_FOUND', 404);
    }

    await this.recordVersionSnapshot(
      latest,
      'amendment',
      summaryParts.length > 0 ? `Amendment applied: ${summaryParts.join('; ')}` : 'Amendment applied',
      {
        reason: input.reason,
        metadata,
        effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : undefined,
        modificationId: input.modificationId
      }
    );

    return latest;
  }

  async listSubscriptionVersions(
    subscriptionId: string,
    limit = 25
  ): Promise<SubscriptionVersion[]> {
    const organizationId = this.requireOrganizationContext();
    const subscription = await this.subscriptionRepository.findByIdWithItems(subscriptionId);
    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }

    return this.subscriptionVersionRepository.listVersions(subscriptionId, { limit });
  }

  async getSubscriptionVersion(
    subscriptionId: string,
    versionId: string
  ): Promise<SubscriptionVersion | null> {
    const organizationId = this.requireOrganizationContext();
    const subscription = await this.subscriptionRepository.findByIdWithItems(subscriptionId);
    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }

    const version = await this.subscriptionVersionRepository.getVersion(versionId);
    if (!version || version.subscriptionId !== subscriptionId) {
      return null;
    }

    return version;
  }

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

    // TODO: Implement revenue calculation engine integration
    // This will be implemented in TASK-009
    
    return {
      subscriptionId,
      calculationType,
      effectiveDate,
      message: 'Revenue calculation will be implemented in TASK-009'
    };
  }

  async getRevenueSchedule(subscriptionId: string): Promise<any> {
    const organizationId = this.requireOrganizationContext();
    
    const subscription = await this.subscriptionRepository.findByIdWithItems(subscriptionId);
    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }

    // TODO: Fetch revenue schedules from revenue_schedules table
    // This will be implemented with the revenue recognition router
    
    return {
      subscriptionId,
      schedules: [],
      message: 'Revenue schedule retrieval will be implemented with revenue recognition router'
    };
  }

  private async generateSubscriptionNumber(): Promise<string> {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `SUB-${timestamp}-${random}`;
  }

  private normalizeSubscriptionUpdate(data: UpdateSubscriptionData): UpdateSubscription {
    const normalized: UpdateSubscription = {};

    if (data.entityId) {
      normalized.entityId = data.entityId;
    }
    if (data.status) {
      normalized.status = data.status;
    }
    if (data.startDate) {
      normalized.startDate = this.coerceDateString(data.startDate);
    }
    if (data.endDate !== undefined) {
      normalized.endDate = data.endDate
        ? this.coerceDateString(data.endDate)
        : null;
    }
    if (data.contractValue !== undefined) {
      normalized.contractValue = data.contractValue === null
        ? null
        : String(data.contractValue);
    }
    if (data.billingFrequency !== undefined) {
      normalized.billingFrequency = data.billingFrequency || null;
    }
    if (data.autoRenew !== undefined) {
      normalized.autoRenew = data.autoRenew;
    }
    if (data.renewalTermMonths !== undefined) {
      normalized.renewalTermMonths = data.renewalTermMonths;
    }
    if (data.metadata !== undefined) {
      normalized.metadata = data.metadata;
    }

    return normalized;
  }

  private normalizeItemInput(
    item: AmendmentItemInput,
    organizationId: string,
    subscriptionId: string,
    defaultStartDate: string
  ): Partial<NewSubscriptionItem> {
    return {
      subscriptionId,
      organizationId,
      itemId: item.itemId,
      quantity: item.quantity !== undefined ? String(item.quantity) : '1',
      unitPrice: item.unitPrice !== undefined ? String(item.unitPrice) : '0',
      discountPercentage: item.discountPercentage !== undefined && item.discountPercentage !== null
        ? String(item.discountPercentage)
        : undefined,
      startDate: item.startDate
        ? this.coerceDateString(item.startDate)
        : this.coerceDateString(defaultStartDate),
      endDate: item.endDate
        ? this.coerceDateString(item.endDate)
        : undefined
    };
  }

  private coerceDateString(value: Date | string): string {
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    return new Date(value).toISOString().split('T')[0];
  }

  private async recordVersionSnapshot(
    subscription: SubscriptionWithItems,
    versionType: SubscriptionVersionTypeValue,
    summary: string,
    options: {
      reason?: string;
      metadata?: Record<string, any>;
      effectiveDate?: Date;
      source?: SubscriptionVersionSourceValue;
      modificationId?: string;
    } = {}
  ): Promise<void> {
    await this.subscriptionVersionRepository.recordVersion({
      subscription,
      versionType,
      versionSource: options.source ?? (this.context.userId ? 'user' : 'system'),
      changeSummary: summary,
      changeReason: options.reason,
      metadata: options.metadata,
      effectiveDate: options.effectiveDate,
      modificationId: options.modificationId,
      createdBy: this.context.userId
    });
  }
}
