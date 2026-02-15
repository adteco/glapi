import { db as globalDb, type ContextualDatabase, kitComponents, items, sspEvidence, type KitComponent } from '@glapi/database';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface KitExplosionResult {
  kitItemId: string;
  components: ComponentAllocation[];
  totalValue: number;
  allocationMethod: 'percentage' | 'ssp_based' | 'equal';
}

export interface ComponentAllocation {
  componentItemId: string;
  componentName: string;
  quantity: number;
  allocationPercentage: number;
  allocatedAmount: number;
  sspAmount?: number;
}

export class KitService {
  private db: ContextualDatabase;

  constructor(db?: ContextualDatabase) {
    // Prefer contextual DB to satisfy RLS (kit_components is protected by RLS).
    this.db = db ?? globalDb;
  }

  /**
   * Explode a kit/bundle into its component items with price allocation
   */
  async explodeKit(
    kitItemId: string, 
    totalKitPrice: number,
    organizationId: string
  ): Promise<KitExplosionResult> {
    // Get kit components
    const components = await this.getKitComponents(kitItemId);
    
    if (components.length === 0) {
      throw new Error(`No components found for kit ${kitItemId}`);
    }
    
    // Determine allocation method
    const allocationMethod = await this.determineAllocationMethod(components, organizationId);
    
    // Allocate price to components
    const allocations = await this.allocateToComponents(
      components,
      totalKitPrice,
      allocationMethod,
      organizationId
    );
    
    return {
      kitItemId,
      components: allocations,
      totalValue: totalKitPrice,
      allocationMethod
    };
  }

  /**
   * Get all components of a kit
   */
  private async getKitComponents(kitItemId: string): Promise<KitComponent[]> {
    const components = await this.db.select()
      .from(kitComponents)
      .where(eq(kitComponents.kitItemId, kitItemId))
      .orderBy(kitComponents.componentItemId);
    
    return components;
  }

  /**
   * Determine the best allocation method based on available data
   */
  private async determineAllocationMethod(
    components: KitComponent[],
    organizationId: string
  ): Promise<'percentage' | 'ssp_based' | 'equal'> {
    // Check if SSP is available for all components
    const hasSSP = await this.checkSSPAvailability(components, organizationId);
    if (hasSSP) {
      return 'ssp_based';
    }
    
    // Default to equal allocation
    return 'equal';
  }

  /**
   * Check if SSP evidence exists for all components
   */
  private async checkSSPAvailability(
    components: KitComponent[],
    organizationId: string
  ): Promise<boolean> {
    for (const component of components) {
      const [evidence] = await this.db.select()
        .from(sspEvidence)
        .where(
          and(
            eq(sspEvidence.organizationId, organizationId),
            eq(sspEvidence.itemId, component.componentItemId),
            eq(sspEvidence.isActive, true)
          )
        )
        .limit(1);
      
      if (!evidence) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Allocate kit price to components based on method
   */
  private async allocateToComponents(
    components: KitComponent[],
    totalPrice: number,
    method: 'percentage' | 'ssp_based' | 'equal',
    organizationId: string
  ): Promise<ComponentAllocation[]> {
    const allocations: ComponentAllocation[] = [];
    
    switch (method) {
      case 'percentage':
        return this.allocateByPercentage(components, totalPrice);
      
      case 'ssp_based':
        return this.allocateBySSP(components, totalPrice, organizationId);
      
      case 'equal':
        return this.allocateEqually(components, totalPrice);
      
      default:
        throw new Error(`Unknown allocation method: ${method}`);
    }
  }

  /**
   * Allocate based on predefined percentages
   */
  private async allocateByPercentage(
    components: KitComponent[],
    totalPrice: number
  ): Promise<ComponentAllocation[]> {
    // The live schema does not support explicit allocation percentages on kit_components.
    // Keep this method for backwards compatibility if we later add a percentage field.
    return this.allocateBySSP(components, totalPrice, '');
  }

  /**
   * Allocate based on SSP ratios
   */
  private async allocateBySSP(
    components: KitComponent[],
    totalPrice: number,
    organizationId: string
  ): Promise<ComponentAllocation[]> {
    const allocations: ComponentAllocation[] = [];
    const componentSSPs: Array<{ component: KitComponent; ssp: number; item: any }> = [];
    
    // Get SSP for each component
    for (const component of components) {
      const [evidence] = await this.db.select()
        .from(sspEvidence)
        .where(
          and(
            eq(sspEvidence.organizationId, organizationId),
            eq(sspEvidence.itemId, component.componentItemId),
            eq(sspEvidence.isActive, true)
          )
        )
        .orderBy(
          // Priority: customer_pricing > comparable_sales > market_research > cost_plus
          sql`
            CASE ${sspEvidence.evidenceType}
              WHEN 'customer_pricing' THEN 1
              WHEN 'comparable_sales' THEN 2
              WHEN 'market_research' THEN 3
              WHEN 'cost_plus' THEN 4
            END
          `,
          desc(sspEvidence.evidenceDate)
        )
        .limit(1);
      
      const [item] = await this.db.select()
        .from(items)
        .where(eq(items.id, component.componentItemId))
        .limit(1);
      
      const qty = parseFloat(component.quantity);
      const sspAmount = evidence ? parseFloat(evidence.sspAmount) * qty : 0;
      componentSSPs.push({ component, ssp: sspAmount, item });
    }
    
    // Calculate total SSP
    const totalSSP = componentSSPs.reduce((sum, c) => sum + c.ssp, 0);
    
    if (totalSSP === 0) {
      // Fall back to equal allocation if no SSP available
      return this.allocateEqually(components, totalPrice);
    }
    
    // Allocate proportionally based on SSP
    for (const { component, ssp, item } of componentSSPs) {
      const allocationPercentage = (ssp / totalSSP) * 100;
      const allocatedAmount = totalPrice * (ssp / totalSSP);
      
      allocations.push({
        componentItemId: component.componentItemId,
        componentName: item?.name || 'Unknown',
        quantity: parseFloat(component.quantity),
        allocationPercentage,
        allocatedAmount,
        sspAmount: ssp
      });
    }
    
    return this.adjustForRounding(allocations, totalPrice);
  }

  /**
   * Allocate equally among components
   */
  private async allocateEqually(
    components: KitComponent[],
    totalPrice: number
  ): Promise<ComponentAllocation[]> {
    const allocations: ComponentAllocation[] = [];
    const equalAmount = totalPrice / components.length;
    const equalPercentage = 100 / components.length;
    
    for (const component of components) {
      const [item] = await this.db.select()
        .from(items)
        .where(eq(items.id, component.componentItemId))
        .limit(1);
      
      allocations.push({
        componentItemId: component.componentItemId,
        componentName: item?.name || 'Unknown',
        quantity: parseFloat(component.quantity),
        allocationPercentage: equalPercentage,
        allocatedAmount: equalAmount
      });
    }
    
    return this.adjustForRounding(allocations, totalPrice);
  }

  /**
   * Adjust for rounding differences to ensure total equals kit price
   */
  private adjustForRounding(
    allocations: ComponentAllocation[],
    totalPrice: number
  ): ComponentAllocation[] {
    const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    const difference = totalPrice - totalAllocated;
    
    if (Math.abs(difference) > 0.01) {
      // Apply difference to the largest allocation
      const largestAllocation = allocations.reduce((max, a) => 
        a.allocatedAmount > max.allocatedAmount ? a : max
      );
      
      largestAllocation.allocatedAmount += difference;
      // Recalculate percentage
      largestAllocation.allocationPercentage = (largestAllocation.allocatedAmount / totalPrice) * 100;
    }
    
    return allocations;
  }

  /**
   * Validate kit configuration
   */
  async validateKitConfiguration(kitItemId: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    const components = await this.getKitComponents(kitItemId);
    
    if (components.length === 0) {
      errors.push('Kit has no components defined');
    }
    
    // Check for duplicate components
    const componentIds = components.map(c => c.componentItemId);
    const uniqueIds = new Set(componentIds);
    if (uniqueIds.size !== componentIds.length) {
      errors.push('Kit contains duplicate components');
    }
    
    // Check for circular references (kit containing itself)
    if (componentIds.includes(kitItemId)) {
      errors.push('Kit contains itself as a component (circular reference)');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create or update kit configuration
   */
  async configureKit(
    kitItemId: string,
    components: Array<{
      componentItemId: string;
      quantity: number;
      allocationPercentage?: number;
    }>,
    organizationId: string
  ): Promise<void> {
    // Delete existing components
    await this.db.delete(kitComponents)
      .where(eq(kitComponents.kitItemId, kitItemId));
    
    // Insert new components
    for (const component of components) {
      await this.db.insert(kitComponents)
        .values({
          kitItemId,
          componentItemId: component.componentItemId,
          quantity: String(component.quantity),
          isOptional: false
        });
    }
  }
}
