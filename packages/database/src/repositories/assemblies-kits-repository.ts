import { and, eq, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { assemblyComponents, kitComponents } from '../db/schema/assemblies-kits';
import { items } from '../db/schema/items';
import type { AssemblyComponent, NewAssemblyComponent, KitComponent, NewKitComponent } from '../db/schema/assemblies-kits';

export interface ComponentWithItem extends AssemblyComponent {
  componentItem?: {
    id: string;
    itemCode: string;
    name: string;
    defaultCost: string | null;
  };
}

export interface KitComponentWithItem extends KitComponent {
  componentItem?: {
    id: string;
    itemCode: string;
    name: string;
    defaultPrice: string | null;
  };
}

export class AssembliesKitsRepository extends BaseRepository {
  // Assembly Methods

  /**
   * Find all components of an assembly
   */
  async findAssemblyComponents(assemblyItemId: string) {
    return await this.db
      .select()
      .from(assemblyComponents)
      .where(eq(assemblyComponents.assemblyItemId, assemblyItemId))
      .orderBy(assemblyComponents.sequenceNumber);
  }

  /**
   * Find assemblies that use a component
   */
  async findAssembliesUsingComponent(componentItemId: string) {
    return await this.db
      .select()
      .from(assemblyComponents)
      .where(eq(assemblyComponents.componentItemId, componentItemId));
  }

  /**
   * Get assembly components with item details
   */
  async getAssemblyComponentsWithDetails(assemblyItemId: string): Promise<ComponentWithItem[]> {
    const results = await this.db
      .select({
        component: assemblyComponents,
        item: {
          id: items.id,
          itemCode: items.itemCode,
          name: items.name,
          defaultCost: items.defaultCost,
        },
      })
      .from(assemblyComponents)
      .innerJoin(items, eq(assemblyComponents.componentItemId, items.id))
      .where(eq(assemblyComponents.assemblyItemId, assemblyItemId))
      .orderBy(assemblyComponents.sequenceNumber);

    return results.map(row => ({
      ...row.component,
      componentItem: row.item,
    }));
  }

  /**
   * Create an assembly component
   */
  async createAssemblyComponent(data: NewAssemblyComponent) {
    // Check for circular reference
    await this.checkCircularReference(data.assemblyItemId, data.componentItemId);

    const results = await this.db
      .insert(assemblyComponents)
      .values(data)
      .returning();
    
    return results[0];
  }

  /**
   * Update an assembly component
   */
  async updateAssemblyComponent(id: string, data: Partial<NewAssemblyComponent>) {
    const results = await this.db
      .update(assemblyComponents)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(assemblyComponents.id, id))
      .returning();
    
    return results[0] || null;
  }

  /**
   * Delete an assembly component
   */
  async deleteAssemblyComponent(id: string) {
    const results = await this.db
      .delete(assemblyComponents)
      .where(eq(assemblyComponents.id, id))
      .returning();
    
    return results[0] || null;
  }

  /**
   * Replace all components of an assembly
   */
  async replaceAssemblyComponents(
    assemblyItemId: string,
    components: Omit<NewAssemblyComponent, 'assemblyItemId'>[]
  ) {
    // Delete existing components
    await this.db
      .delete(assemblyComponents)
      .where(eq(assemblyComponents.assemblyItemId, assemblyItemId));

    // Insert new components
    if (components.length > 0) {
      const newComponents = components.map((comp, index) => ({
        ...comp,
        assemblyItemId,
        sequenceNumber: comp.sequenceNumber || (index + 1) * 10,
      }));

      return await this.db
        .insert(assemblyComponents)
        .values(newComponents)
        .returning();
    }

    return [];
  }

  /**
   * Calculate total cost of an assembly
   */
  async calculateAssemblyCost(assemblyItemId: string): Promise<number> {
    const components = await this.getAssemblyComponentsWithDetails(assemblyItemId);
    
    let totalCost = 0;
    for (const component of components) {
      if (component.componentItem?.defaultCost) {
        const componentCost = parseFloat(component.componentItem.defaultCost);
        const quantity = parseFloat(component.quantity);
        totalCost += componentCost * quantity;
      }
    }

    return totalCost;
  }

  /**
   * Check for circular references in assembly
   */
  private async checkCircularReference(
    assemblyItemId: string,
    componentItemId: string,
    visited: Set<string> = new Set()
  ): Promise<void> {
    if (assemblyItemId === componentItemId) {
      throw new Error('An item cannot be a component of itself');
    }

    if (visited.has(componentItemId)) {
      throw new Error('Circular reference detected in assembly structure');
    }

    visited.add(componentItemId);

    // Check if the component is itself an assembly
    const subComponents = await this.findAssemblyComponents(componentItemId);
    
    for (const subComponent of subComponents) {
      await this.checkCircularReference(
        assemblyItemId,
        subComponent.componentItemId,
        visited
      );
    }
  }

  // Kit Methods

  /**
   * Find all components of a kit
   */
  async findKitComponents(kitItemId: string) {
    return await this.db
      .select()
      .from(kitComponents)
      .where(eq(kitComponents.kitItemId, kitItemId))
      .orderBy(kitComponents.createdAt);
  }

  /**
   * Find kits that include a component
   */
  async findKitsIncludingComponent(componentItemId: string) {
    return await this.db
      .select()
      .from(kitComponents)
      .where(eq(kitComponents.componentItemId, componentItemId));
  }

  /**
   * Get kit components with item details
   */
  async getKitComponentsWithDetails(kitItemId: string): Promise<KitComponentWithItem[]> {
    const results = await this.db
      .select({
        component: kitComponents,
        item: {
          id: items.id,
          itemCode: items.itemCode,
          name: items.name,
          defaultPrice: items.defaultPrice,
        },
      })
      .from(kitComponents)
      .innerJoin(items, eq(kitComponents.componentItemId, items.id))
      .where(eq(kitComponents.kitItemId, kitItemId));

    return results.map(row => ({
      ...row.component,
      componentItem: row.item,
    }));
  }

  /**
   * Create a kit component
   */
  async createKitComponent(data: NewKitComponent) {
    // Check for duplicate
    const existing = await this.db
      .select()
      .from(kitComponents)
      .where(
        and(
          eq(kitComponents.kitItemId, data.kitItemId),
          eq(kitComponents.componentItemId, data.componentItemId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error('Component already exists in kit');
    }

    const results = await this.db
      .insert(kitComponents)
      .values(data)
      .returning();
    
    return results[0];
  }

  /**
   * Update a kit component
   */
  async updateKitComponent(id: string, data: Partial<NewKitComponent>) {
    const results = await this.db
      .update(kitComponents)
      .set(data)
      .where(eq(kitComponents.id, id))
      .returning();
    
    return results[0] || null;
  }

  /**
   * Delete a kit component
   */
  async deleteKitComponent(id: string) {
    const results = await this.db
      .delete(kitComponents)
      .where(eq(kitComponents.id, id))
      .returning();
    
    return results[0] || null;
  }

  /**
   * Replace all components of a kit
   */
  async replaceKitComponents(
    kitItemId: string,
    components: Omit<NewKitComponent, 'kitItemId'>[]
  ) {
    // Delete existing components
    await this.db
      .delete(kitComponents)
      .where(eq(kitComponents.kitItemId, kitItemId));

    // Insert new components
    if (components.length > 0) {
      const newComponents = components.map(comp => ({
        ...comp,
        kitItemId,
      }));

      return await this.db
        .insert(kitComponents)
        .values(newComponents)
        .returning();
    }

    return [];
  }

  /**
   * Calculate total price of a kit
   */
  async calculateKitPrice(kitItemId: string): Promise<number> {
    const components = await this.getKitComponentsWithDetails(kitItemId);
    
    let totalPrice = 0;
    for (const component of components) {
      if (!component.isOptional && component.componentItem?.defaultPrice) {
        const componentPrice = parseFloat(component.componentItem.defaultPrice);
        const quantity = parseFloat(component.quantity);
        totalPrice += componentPrice * quantity;
      }
    }

    return totalPrice;
  }

  /**
   * Get all assemblies
   */
  async getAllAssemblies(organizationId: string) {
    return await this.db
      .select()
      .from(items)
      .where(
        and(
          eq(items.organizationId, organizationId),
          eq(items.itemType, 'ASSEMBLY'),
          eq(items.isActive, true)
        )
      )
      .orderBy(items.itemCode);
  }

  /**
   * Get all kits
   */
  async getAllKits(organizationId: string) {
    return await this.db
      .select()
      .from(items)
      .where(
        and(
          eq(items.organizationId, organizationId),
          eq(items.itemType, 'KIT'),
          eq(items.isActive, true)
        )
      )
      .orderBy(items.itemCode);
  }

  /**
   * Explode a kit into its components (for order processing)
   */
  async explodeKit(kitItemId: string, quantity: number = 1) {
    const components = await this.getKitComponentsWithDetails(kitItemId);
    
    return components.map(component => ({
      itemId: component.componentItemId,
      itemCode: component.componentItem?.itemCode,
      itemName: component.componentItem?.name,
      quantity: parseFloat(component.quantity) * quantity,
      isOptional: component.isOptional,
    }));
  }

  /**
   * Check if an item is used in any assembly or kit
   */
  async isItemUsedInBOM(itemId: string): Promise<boolean> {
    const [assemblyCount, kitCount] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(assemblyComponents)
        .where(eq(assemblyComponents.componentItemId, itemId)),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(kitComponents)
        .where(eq(kitComponents.componentItemId, itemId)),
    ]);

    return (assemblyCount[0]?.count || 0) + (kitCount[0]?.count || 0) > 0;
  }
}