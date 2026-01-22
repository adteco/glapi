import { db, Database } from '../db';
import { 
  contractModifications,
  modificationLineItems,
  catchUpAdjustments,
  ContractModification,
  NewContractModification,
  UpdateContractModification,
  ModificationLineItem,
  NewModificationLineItem,
  CatchUpAdjustment,
  NewCatchUpAdjustment
} from '../db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';

export class ContractModificationRepository {
  constructor(private database: Database = db) {}

  /**
   * Create a new contract modification
   */
  async createModification(
    data: NewContractModification
  ): Promise<ContractModification> {
    const result = await this.database
      .insert(contractModifications)
      .values(data)
      .returning();
    
    return result[0];
  }

  /**
   * Update contract modification
   */
  async updateModification(
    id: string,
    data: UpdateContractModification
  ): Promise<ContractModification | null> {
    const [updated] = await this.database
      .update(contractModifications)
      .set(data)
      .where(eq(contractModifications.id, id))
      .returning();
    
    return updated || null;
  }

  /**
   * Get modification by ID
   */
  async getModification(id: string): Promise<ContractModification | null> {
    const [modification] = await this.database
      .select()
      .from(contractModifications)
      .where(eq(contractModifications.id, id))
      .limit(1);
    
    return modification || null;
  }

  /**
   * Get modifications by subscription
   */
  async getModificationsBySubscription(
    subscriptionId: string
  ): Promise<ContractModification[]> {
    return await this.database
      .select()
      .from(contractModifications)
      .where(eq(contractModifications.subscriptionId, subscriptionId))
      .orderBy(desc(contractModifications.effectiveDate));
  }

  /**
   * Get modifications by status
   */
  async getModificationsByStatus(
    organizationId: string,
    status: string
  ): Promise<ContractModification[]> {
    return await this.database
      .select()
      .from(contractModifications)
      .where(
        and(
          eq(contractModifications.organizationId, organizationId),
          eq(contractModifications.status, status as any)
        )
      )
      .orderBy(desc(contractModifications.createdAt));
  }

  /**
   * Create modification line items
   */
  async createLineItems(
    items: NewModificationLineItem[]
  ): Promise<ModificationLineItem[]> {
    if (items.length === 0) return [];
    
    return await this.database
      .insert(modificationLineItems)
      .values(items)
      .returning();
  }

  /**
   * Update modification line item
   */
  async updateLineItem(
    id: string,
    data: Partial<ModificationLineItem>
  ): Promise<ModificationLineItem | null> {
    const [updated] = await this.database
      .update(modificationLineItems)
      .set(data)
      .where(eq(modificationLineItems.id, id))
      .returning();
    
    return updated || null;
  }

  /**
   * Get line items for modification
   */
  async getLineItemsByModification(
    modificationId: string
  ): Promise<ModificationLineItem[]> {
    return await this.database
      .select()
      .from(modificationLineItems)
      .where(eq(modificationLineItems.modificationId, modificationId))
      .orderBy(asc(modificationLineItems.createdAt));
  }

  /**
   * Delete modification line item
   */
  async deleteLineItem(id: string): Promise<void> {
    await this.database
      .delete(modificationLineItems)
      .where(eq(modificationLineItems.id, id));
  }

  /**
   * Create catch-up adjustment
   */
  async createCatchUpAdjustment(
    data: NewCatchUpAdjustment
  ): Promise<CatchUpAdjustment> {
    const [adjustment] = await this.database
      .insert(catchUpAdjustments)
      .values(data)
      .returning();
    
    return adjustment;
  }

  /**
   * Update catch-up adjustment
   */
  async updateCatchUpAdjustment(
    id: string,
    data: Partial<CatchUpAdjustment>
  ): Promise<CatchUpAdjustment | null> {
    const [updated] = await this.database
      .update(catchUpAdjustments)
      .set(data)
      .where(eq(catchUpAdjustments.id, id))
      .returning();
    
    return updated || null;
  }

  /**
   * Get catch-up adjustments by modification
   */
  async getCatchUpAdjustmentsByModification(
    modificationId: string
  ): Promise<CatchUpAdjustment[]> {
    return await this.database
      .select()
      .from(catchUpAdjustments)
      .where(eq(catchUpAdjustments.modificationId, modificationId))
      .orderBy(asc(catchUpAdjustments.adjustmentDate));
  }

  /**
   * Get pending modifications
   */
  async getPendingModifications(
    organizationId: string
  ): Promise<ContractModification[]> {
    return await this.database
      .select()
      .from(contractModifications)
      .where(
        and(
          eq(contractModifications.organizationId, organizationId),
          eq(contractModifications.status, 'pending_approval')
        )
      )
      .orderBy(asc(contractModifications.effectiveDate));
  }

  /**
   * Delete modification and related data
   */
  async deleteModification(id: string): Promise<void> {
    // Delete related data first
    await this.database
      .delete(catchUpAdjustments)
      .where(eq(catchUpAdjustments.modificationId, id));
    
    await this.database
      .delete(modificationLineItems)
      .where(eq(modificationLineItems.modificationId, id));
    
    // Delete the modification
    await this.database
      .delete(contractModifications)
      .where(eq(contractModifications.id, id));
  }
}