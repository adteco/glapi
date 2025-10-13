import { eq, and, desc } from "drizzle-orm";
import { subscriptionItems, type SubscriptionItem, type NewSubscriptionItem, type UpdateSubscriptionItem } from "../db/schema/subscription-items";
import { BaseRepository } from "./base-repository";

export class SubscriptionItemRepository extends BaseRepository {
  constructor() {
    super();
  }

  /**
   * Create a new subscription item
   */
  async create(data: NewSubscriptionItem): Promise<SubscriptionItem> {
    const [result] = await this.db
      .insert(subscriptionItems)
      .values(data)
      .returning();
    return result;
  }

  /**
   * Find subscription item by ID
   */
  async findById(id: string): Promise<SubscriptionItem | null> {
    const [result] = await this.db
      .select()
      .from(subscriptionItems)
      .where(eq(subscriptionItems.id, id))
      .limit(1);

    return result || null;
  }

  /**
   * Find all items for a subscription
   */
  async findBySubscriptionId(subscriptionId: string): Promise<SubscriptionItem[]> {
    return await this.db
      .select()
      .from(subscriptionItems)
      .where(eq(subscriptionItems.subscriptionId, subscriptionId))
      .orderBy(desc(subscriptionItems.createdAt));
  }

  /**
   * Find items by subscription and organization
   */
  async findBySubscriptionAndOrg(subscriptionId: string, organizationId: string): Promise<SubscriptionItem[]> {
    return await this.db
      .select()
      .from(subscriptionItems)
      .where(
        and(
          eq(subscriptionItems.subscriptionId, subscriptionId),
          eq(subscriptionItems.organizationId, organizationId)
        )
      )
      .orderBy(desc(subscriptionItems.createdAt));
  }

  /**
   * Update subscription item
   */
  async update(id: string, data: UpdateSubscriptionItem): Promise<SubscriptionItem | null> {
    const [updated] = await this.db
      .update(subscriptionItems)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(subscriptionItems.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Delete subscription item
   */
  async delete(id: string): Promise<void> {
    await this.db
      .delete(subscriptionItems)
      .where(eq(subscriptionItems.id, id));
  }

  /**
   * Delete all items for a subscription
   */
  async deleteBySubscriptionId(subscriptionId: string): Promise<void> {
    await this.db
      .delete(subscriptionItems)
      .where(eq(subscriptionItems.subscriptionId, subscriptionId));
  }

  /**
   * Count items for a subscription
   */
  async countBySubscriptionId(subscriptionId: string): Promise<number> {
    const [{ count }] = await this.db
      .select({ count: subscriptionItems.id })
      .from(subscriptionItems)
      .where(eq(subscriptionItems.subscriptionId, subscriptionId));

    return Number(count);
  }

  /**
   * Calculate total value for a subscription
   */
  async calculateTotalValue(subscriptionId: string): Promise<number> {
    const items = await this.findBySubscriptionId(subscriptionId);
    
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
   * Find many with filtering
   */
  async findMany(options: {
    where?: any;
    skip?: number;
    take?: number;
    orderBy?: any;
  }): Promise<SubscriptionItem[]> {
    let query = this.db.select().from(subscriptionItems);

    if (options.where) {
      query = query.where(options.where) as any;
    }

    if (options.orderBy) {
      query = query.orderBy(options.orderBy) as any;
    }

    if (options.skip !== undefined) {
      query = query.offset(options.skip) as any;
    }

    if (options.take !== undefined) {
      query = query.limit(options.take) as any;
    }

    return await query;
  }

  /**
   * Count with filtering
   */
  async count(options: { where?: any }): Promise<number> {
    let query = this.db.select({ count: subscriptionItems.id }).from(subscriptionItems);

    if (options.where) {
      query = query.where(options.where) as any;
    }

    const [result] = await query;
    return Number(result.count);
  }
}