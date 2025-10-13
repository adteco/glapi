import { BaseService } from './base-service';
import { ServiceContext, ServiceError, PaginatedResult } from '../types';
import { 
  SubscriptionRepository, 
  SubscriptionItemRepository,
  type Subscription,
  type NewSubscription,
  type UpdateSubscription,
  type SubscriptionItem,
  type NewSubscriptionItem,
  type SubscriptionWithItems as RepoSubscriptionWithItems
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

  constructor(context: ServiceContext = {}) {
    super(context);
    this.subscriptionRepository = new SubscriptionRepository();
    this.subscriptionItemRepository = new SubscriptionItemRepository();
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

    return await this.subscriptionRepository.createWithItems(subscriptionToCreate, itemsToCreate);
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

    return {
      ...updatedSubscription,
      items: currentItems as any
    };
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

    return {
      ...updatedSubscription,
      items
    };
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

    return {
      ...updatedSubscription,
      items: subscription.items || []
    } as SubscriptionWithItems;
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
}