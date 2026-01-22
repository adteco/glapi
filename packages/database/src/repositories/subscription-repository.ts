import { eq, and, desc, gte, lte, or, ilike, sql } from "drizzle-orm";
import { subscriptions, type Subscription, type NewSubscription, type UpdateSubscription } from "../db/schema/subscriptions";
import { subscriptionItems } from "../db/schema/subscription-items";
import { type NewSubscriptionItem, type UpdateSubscriptionItem } from "../db/schema/subscription-items";
import { BaseRepository } from "./base-repository";

export interface SubscriptionWithItems extends Subscription {
  items?: Array<{
    id: string;
    itemId: string;
    quantity: string;
    unitPrice: string;
    discountPercentage: string | null;
    startDate: string;
    endDate: string | null;
    metadata: unknown;
  }>;
}

export interface SubscriptionListOptions {
  organizationId: string;
  entityId?: string;
  status?: string;
  startDateFrom?: string;
  startDateTo?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

export class SubscriptionRepository extends BaseRepository {
  constructor() {
    super();
  }

  /**
   * Create a new subscription
   */
  async create(data: NewSubscription): Promise<Subscription> {
    const [result] = await this.db
      .insert(subscriptions)
      .values(data)
      .returning();
    return result;
  }

  /**
   * Find subscription by ID with items
   */
  async findByIdWithItems(id: string): Promise<SubscriptionWithItems | null> {
    const results = await this.db
      .select()
      .from(subscriptions)
      .leftJoin(subscriptionItems, eq(subscriptionItems.subscriptionId, subscriptions.id))
      .where(eq(subscriptions.id, id));

    if (results.length === 0) {
      return null;
    }

    const subscription = results[0].subscriptions;
    const items = results
      .filter(r => r.subscription_items !== null)
      .map(r => r.subscription_items!);

    return {
      ...subscription,
      items
    };
  }

  /**
   * Find subscription by subscription number
   */
  async findByNumber(organizationId: string, subscriptionNumber: string): Promise<Subscription | null> {
    const [result] = await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, organizationId),
          eq(subscriptions.subscriptionNumber, subscriptionNumber)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * List subscriptions with filtering
   */
  async list(options: SubscriptionListOptions): Promise<{ data: Subscription[]; total: number }> {
    const conditions = [eq(subscriptions.organizationId, options.organizationId)];

    if (options.entityId) {
      conditions.push(eq(subscriptions.entityId, options.entityId));
    }

    if (options.status) {
      conditions.push(eq(subscriptions.status, options.status as any));
    }

    if (options.startDateFrom) {
      conditions.push(gte(subscriptions.startDate, options.startDateFrom));
    }

    if (options.startDateTo) {
      conditions.push(lte(subscriptions.startDate, options.startDateTo));
    }

    if (options.search) {
      conditions.push(
        ilike(subscriptions.subscriptionNumber, `%${options.search}%`)
      );
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count }] = await this.db
      .select({ count: subscriptions.id })
      .from(subscriptions)
      .where(whereClause);

    // Get paginated results
    const data = await this.db
      .select()
      .from(subscriptions)
      .where(whereClause)
      .orderBy(desc(subscriptions.createdAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0);

    return {
      data,
      total: Number(count)
    };
  }

  /**
   * Create subscription with items
   */
  async createWithItems(
    subscription: NewSubscription,
    items: Omit<NewSubscriptionItem, "subscriptionId">[]
  ): Promise<SubscriptionWithItems> {
    return await this.db.transaction(async (tx) => {
      // Create subscription
      const [newSubscription] = await tx
        .insert(subscriptions)
        .values(subscription)
        .returning();

      // Create subscription items if provided
      let createdItems: any[] = [];
      if (items && items.length > 0) {
        const itemsToCreate = items.map(item => ({
          ...item,
          subscriptionId: newSubscription.id
        }));

        createdItems = await tx
          .insert(subscriptionItems)
          .values(itemsToCreate)
          .returning();
      }

      return {
        ...newSubscription,
        items: createdItems
      };
    });
  }

  /**
   * Update subscription
   */
  async update(id: string, data: UpdateSubscription): Promise<Subscription | null> {
    const [updated] = await this.db
      .update(subscriptions)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(subscriptions.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Add item to subscription
   */
  async addItem(item: NewSubscriptionItem): Promise<any> {
    const [newItem] = await this.db
      .insert(subscriptionItems)
      .values(item)
      .returning();

    return newItem;
  }

  /**
   * Update subscription item
   */
  async updateItem(itemId: string, data: UpdateSubscriptionItem): Promise<any> {
    const [updated] = await this.db
      .update(subscriptionItems)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(subscriptionItems.id, itemId))
      .returning();

    return updated;
  }

  /**
   * Remove item from subscription
   */
  async removeItem(itemId: string): Promise<void> {
    await this.db
      .delete(subscriptionItems)
      .where(eq(subscriptionItems.id, itemId));
  }

  /**
   * Calculate total contract value from items
   */
  async calculateContractValue(subscriptionId: string): Promise<number> {
    const items = await this.db
      .select()
      .from(subscriptionItems)
      .where(eq(subscriptionItems.subscriptionId, subscriptionId));

    return items.reduce((total, item) => {
      const quantity = parseFloat(item.quantity);
      const unitPrice = parseFloat(item.unitPrice);
      const discountPercentage = item.discountPercentage ? parseFloat(item.discountPercentage) : 0;
      
      const lineTotal = quantity * unitPrice;
      const discountAmount = lineTotal * (discountPercentage / 100);
      
      return total + (lineTotal - discountAmount);
    }, 0);
  }

  /**
   * Get active subscriptions for an entity
   */
  async getActiveSubscriptionsByEntity(organizationId: string, entityId: string): Promise<Subscription[]> {
    return await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, organizationId),
          eq(subscriptions.entityId, entityId),
          eq(subscriptions.status, "active")
        )
      )
      .orderBy(desc(subscriptions.startDate));
  }

  /**
   * Check for overlapping subscriptions
   */
  async hasOverlappingSubscription(
    organizationId: string,
    entityId: string,
    startDate: string,
    endDate: string | null,
    excludeId?: string
  ): Promise<boolean> {
    const conditions = [
      eq(subscriptions.organizationId, organizationId),
      eq(subscriptions.entityId, entityId),
      eq(subscriptions.status, "active")
    ];

    if (excludeId) {
      conditions.push(eq(subscriptions.id, excludeId));
    }

    const existingSubscriptions = await this.db
      .select()
      .from(subscriptions)
      .where(and(...conditions));

    return existingSubscriptions.some(sub => {
      const subStart = new Date(sub.startDate);
      const subEnd = sub.endDate ? new Date(sub.endDate) : null;
      const newStart = new Date(startDate);
      const newEnd = endDate ? new Date(endDate) : null;

      // Check for overlap
      if (!subEnd && !newEnd) {
        return true; // Both are open-ended
      }
      if (!subEnd) {
        return newStart <= subStart || (newEnd && newEnd >= subStart);
      }
      if (!newEnd) {
        return newStart <= subEnd;
      }
      return newStart <= subEnd && newEnd >= subStart;
    });
  }
}