import { db } from '@glapi/database';
import { 
  kitComponents,
  items,
  sspEvidence,
  type KitComponent
} from '@glapi/database';
import { eq, and, sql } from 'drizzle-orm';

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
    const components = await db.select()
      .from(kitComponents)
      .where(eq(kitComponents.parentItemId, kitItemId))
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
    // Check if explicit allocation percentages are defined
    const hasPercentages = components.every(c => 
      c.allocationPercentage && parseFloat(c.allocationPercentage) > 0
    );
    
    if (hasPercentages) {
      // Validate percentages sum to 100
      const totalPercentage = components.reduce((sum, c) => 
        sum + parseFloat(c.allocationPercentage || '0'), 0
      );
      
      if (Math.abs(totalPercentage - 100) < 0.01) {
        return 'percentage';
      }
    }
    
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
      const [evidence] = await db.select()
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
    const allocations: ComponentAllocation[] = [];
    
    for (const component of components) {
      const percentage = parseFloat(component.allocationPercentage || '0') / 100;
      const allocatedAmount = totalPrice * percentage;
      
      const [item] = await db.select()
        .from(items)
        .where(eq(items.id, component.componentItemId))
        .limit(1);
      
      allocations.push({
        componentItemId: component.componentItemId,
        componentName: item?.name || 'Unknown',
        quantity: parseFloat(component.quantity),
        allocationPercentage: percentage * 100,
        allocatedAmount
      });
    }
    
    return this.adjustForRounding(allocations, totalPrice);
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
      const [evidence] = await db.select()
        .from(sspEvidence)
        .where(
          and(
            eq(sspEvidence.organizationId, organizationId),
            eq(sspEvidence.itemId, component.componentItemId),
            eq(sspEvidence.isActive, true)
          )
        )
        .orderBy(
          // Priority: standalone_sale > competitor_pricing > cost_plus_margin > market_assessment
          // @ts-ignore - SQL template compatibility
          sql`
            CASE ${sspEvidence.evidenceType}
              WHEN 'standalone_sale' THEN 1
              WHEN 'competitor_pricing' THEN 2
              WHEN 'cost_plus_margin' THEN 3
              WHEN 'market_assessment' THEN 4
            END
          `
        )
        .limit(1);
      
      const [item] = await db.select()
        .from(items)
        .where(eq(items.id, component.componentItemId))
        .limit(1);
      
      const sspAmount = evidence ? parseFloat(evidence.sspAmount) : 0;
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
      const [item] = await db.select()
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
    
    // Check if percentages are defined and sum to 100
    const hasPercentages = components.some(c => c.allocationPercentage);
    if (hasPercentages) {
      const totalPercentage = components.reduce((sum, c) => 
        sum + parseFloat(c.allocationPercentage || '0'), 0
      );
      
      if (Math.abs(totalPercentage - 100) > 0.01) {
        errors.push(`Allocation percentages sum to ${totalPercentage}%, should be 100%`);
      }
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
    await db.delete(kitComponents)
      .where(eq(kitComponents.parentItemId, kitItemId));
    
    // Insert new components
    for (const component of components) {
      await db.insert(kitComponents)
        .values({
          organizationId,
          parentItemId: kitItemId,
          componentItemId: component.componentItemId,
          quantity: String(component.quantity),
          allocationPercentage: component.allocationPercentage 
            ? String(component.allocationPercentage) 
            : null
        });
    }
  }
}