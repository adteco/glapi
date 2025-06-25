import { BaseService } from './base-service';
import { 
  AssemblyKitComponent,
  CreateAssemblyKitComponentInput,
  UpdateAssemblyKitComponentInput,
  createAssemblyKitComponentSchema,
  updateAssemblyKitComponentSchema,
  ServiceError,
  PaginatedResult,
  PaginationParams
} from '../types';
import { AssembliesKitsRepository } from '../../../database/src/repositories/assemblies-kits-repository';
import { ItemsRepository } from '../../../database/src/repositories/items-repository';
import { UnitsOfMeasureRepository } from '../../../database/src/repositories/units-of-measure-repository';

const assembliesKitsRepository = new AssembliesKitsRepository();
const itemsRepository = new ItemsRepository();
const unitsOfMeasureRepository = new UnitsOfMeasureRepository();

export class AssembliesKitsService extends BaseService {
  /**
   * Transform database record to service layer type
   */
  private transformAssemblyKitComponent(dbRecord: any): AssemblyKitComponent {
    return {
      id: dbRecord.id,
      parentItemId: dbRecord.parentItemId,
      componentItemId: dbRecord.componentItemId,
      quantity: parseFloat(dbRecord.quantity),
      unitOfMeasureId: dbRecord.unitOfMeasureId,
      displayOrder: dbRecord.displayOrder,
      isOptional: dbRecord.isOptional,
      notes: dbRecord.notes,
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
    };
  }

  /**
   * Get components for an assembly or kit
   */
  async getComponents(
    parentItemId: string,
    params: PaginationParams = {}
  ): Promise<PaginatedResult<AssemblyKitComponent>> {
    const organizationId = this.requireOrganizationContext();
    const { page, limit } = this.getPaginationParams(params);
    
    // Validate parent item
    const parentItem = await itemsRepository.findById(parentItemId, organizationId);
    if (!parentItem) {
      throw new ServiceError(
        'Parent item not found',
        'PARENT_NOT_FOUND',
        404
      );
    }
    
    if (parentItem.itemType !== 'ASSEMBLY' && parentItem.itemType !== 'KIT') {
      throw new ServiceError(
        'Item must be an assembly or kit',
        'INVALID_ITEM_TYPE',
        400
      );
    }
    
    const components = await assembliesKitsRepository.findComponentsByParent(
      parentItemId
    );
    
    // Manual pagination
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const paginatedData = components.slice(startIdx, endIdx);
    
    return this.createPaginatedResult(
      paginatedData.map(c => this.transformAssemblyKitComponent(c)),
      components.length,
      page,
      limit
    );
  }

  /**
   * Get assemblies/kits that use a component
   */
  async getAssembliesUsingComponent(
    componentItemId: string,
    params: PaginationParams = {}
  ): Promise<PaginatedResult<AssemblyKitComponent>> {
    const organizationId = this.requireOrganizationContext();
    const { page, limit } = this.getPaginationParams(params);
    
    // Validate component item
    const componentItem = await itemsRepository.findById(
      componentItemId,
      organizationId
    );
    if (!componentItem) {
      throw new ServiceError(
        'Component item not found',
        'COMPONENT_NOT_FOUND',
        404
      );
    }
    
    const assemblies = await assembliesKitsRepository.findParentsByComponent(
      componentItemId
    );
    
    // Manual pagination
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const paginatedData = assemblies.slice(startIdx, endIdx);
    
    return this.createPaginatedResult(
      paginatedData.map(a => this.transformAssemblyKitComponent(a)),
      assemblies.length,
      page,
      limit
    );
  }

  /**
   * Add component to assembly/kit
   */
  async addComponent(input: CreateAssemblyKitComponentInput): Promise<AssemblyKitComponent> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    
    // Validate input
    const validatedInput = createAssemblyKitComponentSchema.parse(input);
    
    // Validate parent item
    const parentItem = await itemsRepository.findById(
      validatedInput.parentItemId,
      organizationId
    );
    if (!parentItem) {
      throw new ServiceError(
        'Parent item not found',
        'PARENT_NOT_FOUND',
        404
      );
    }
    
    if (parentItem.itemType !== 'ASSEMBLY' && parentItem.itemType !== 'KIT') {
      throw new ServiceError(
        'Parent item must be an assembly or kit',
        'INVALID_PARENT_TYPE',
        400
      );
    }
    
    // Validate component item
    const componentItem = await itemsRepository.findById(
      validatedInput.componentItemId,
      organizationId
    );
    if (!componentItem) {
      throw new ServiceError(
        'Component item not found',
        'COMPONENT_NOT_FOUND',
        404
      );
    }
    
    // Prevent assembly/kit from being its own component
    if (validatedInput.parentItemId === validatedInput.componentItemId) {
      throw new ServiceError(
        'An item cannot be a component of itself',
        'SELF_REFERENCE',
        400
      );
    }
    
    // Check for circular reference
    const hasCircularRef = await assembliesKitsRepository.hasCircularReference(
      validatedInput.parentItemId,
      validatedInput.componentItemId
    );
    if (hasCircularRef) {
      throw new ServiceError(
        'Adding this component would create a circular reference',
        'CIRCULAR_REFERENCE',
        400
      );
    }
    
    // Check if component already exists
    const existing = await assembliesKitsRepository.findComponent(
      validatedInput.parentItemId,
      validatedInput.componentItemId
    );
    if (existing) {
      throw new ServiceError(
        'Component already exists in this assembly/kit',
        'DUPLICATE_COMPONENT',
        409
      );
    }
    
    // Validate unit of measure
    const uom = await unitsOfMeasureRepository.findById(
      validatedInput.unitOfMeasureId,
      organizationId
    );
    if (!uom) {
      throw new ServiceError(
        'Unit of measure not found',
        'INVALID_UOM',
        400
      );
    }
    
    // Check if UOM is compatible with component's UOM
    const canConvert = await unitsOfMeasureRepository.calculateConversion(
      validatedInput.unitOfMeasureId,
      componentItem.unitOfMeasureId,
      organizationId
    );
    if (canConvert === null) {
      throw new ServiceError(
        'Unit of measure is not compatible with component item',
        'INCOMPATIBLE_UOM',
        400
      );
    }
    
    const created = await assembliesKitsRepository.create({
      parentItemId: validatedInput.parentItemId,
      componentItemId: validatedInput.componentItemId,
      quantity: validatedInput.quantity.toString(),
      unitOfMeasureId: validatedInput.unitOfMeasureId,
      displayOrder: validatedInput.displayOrder || 
        (await this.getNextDisplayOrder(validatedInput.parentItemId)),
      isOptional: validatedInput.isOptional || false,
      notes: validatedInput.notes,
      createdBy: userId,
      updatedBy: userId,
    });
    
    return this.transformAssemblyKitComponent(created);
  }

  /**
   * Update component in assembly/kit
   */
  async updateComponent(
    id: string,
    input: UpdateAssemblyKitComponentInput
  ): Promise<AssemblyKitComponent> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    
    // Validate input
    const validatedInput = updateAssemblyKitComponentSchema.parse(input);
    
    // Get existing component
    const existing = await assembliesKitsRepository.findById(id);
    if (!existing) {
      throw new ServiceError(
        'Component not found',
        'COMPONENT_NOT_FOUND',
        404
      );
    }
    
    // Validate ownership through parent item
    const parentItem = await itemsRepository.findById(
      existing.parentItemId,
      organizationId
    );
    if (!parentItem) {
      throw new ServiceError(
        'Component not found',
        'COMPONENT_NOT_FOUND',
        404
      );
    }
    
    // Validate unit of measure if changed
    if (validatedInput.unitOfMeasureId) {
      const uom = await unitsOfMeasureRepository.findById(
        validatedInput.unitOfMeasureId,
        organizationId
      );
      if (!uom) {
        throw new ServiceError(
          'Unit of measure not found',
          'INVALID_UOM',
          400
        );
      }
      
      // Check if new UOM is compatible
      const componentItem = await itemsRepository.findById(
        existing.componentItemId,
        organizationId
      );
      if (componentItem) {
        const canConvert = await unitsOfMeasureRepository.calculateConversion(
          validatedInput.unitOfMeasureId,
          componentItem.unitOfMeasureId,
          organizationId
        );
        if (canConvert === null) {
          throw new ServiceError(
            'Unit of measure is not compatible with component item',
            'INCOMPATIBLE_UOM',
            400
          );
        }
      }
    }
    
    const updateData: any = {
      ...validatedInput,
      updatedBy: userId,
    };
    
    if (validatedInput.quantity !== undefined) {
      updateData.quantity = validatedInput.quantity.toString();
    }
    
    const updated = await assembliesKitsRepository.update(id, updateData);
    
    if (!updated) {
      throw new ServiceError(
        'Failed to update component',
        'UPDATE_FAILED',
        500
      );
    }
    
    return this.transformAssemblyKitComponent(updated);
  }

  /**
   * Remove component from assembly/kit
   */
  async removeComponent(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    // Get existing component
    const existing = await assembliesKitsRepository.findById(id);
    if (!existing) {
      throw new ServiceError(
        'Component not found',
        'COMPONENT_NOT_FOUND',
        404
      );
    }
    
    // Validate ownership through parent item
    const parentItem = await itemsRepository.findById(
      existing.parentItemId,
      organizationId
    );
    if (!parentItem) {
      throw new ServiceError(
        'Component not found',
        'COMPONENT_NOT_FOUND',
        404
      );
    }
    
    await assembliesKitsRepository.delete(id);
  }

  /**
   * Copy BOM from one item to another
   */
  async copyBOM(
    sourceItemId: string,
    targetItemId: string
  ): Promise<AssemblyKitComponent[]> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    
    // Validate source item
    const sourceItem = await itemsRepository.findById(sourceItemId, organizationId);
    if (!sourceItem) {
      throw new ServiceError(
        'Source item not found',
        'SOURCE_NOT_FOUND',
        404
      );
    }
    
    if (sourceItem.itemType !== 'ASSEMBLY' && sourceItem.itemType !== 'KIT') {
      throw new ServiceError(
        'Source item must be an assembly or kit',
        'INVALID_SOURCE_TYPE',
        400
      );
    }
    
    // Validate target item
    const targetItem = await itemsRepository.findById(targetItemId, organizationId);
    if (!targetItem) {
      throw new ServiceError(
        'Target item not found',
        'TARGET_NOT_FOUND',
        404
      );
    }
    
    if (targetItem.itemType !== 'ASSEMBLY' && targetItem.itemType !== 'KIT') {
      throw new ServiceError(
        'Target item must be an assembly or kit',
        'INVALID_TARGET_TYPE',
        400
      );
    }
    
    // Check if target already has components
    const existingComponents = await assembliesKitsRepository.findComponentsByParent(
      targetItemId
    );
    if (existingComponents.length > 0) {
      throw new ServiceError(
        'Target item already has components',
        'TARGET_HAS_COMPONENTS',
        409
      );
    }
    
    const copiedComponents = await assembliesKitsRepository.copyBOM(
      sourceItemId,
      targetItemId,
      userId
    );
    
    return copiedComponents.map(c => this.transformAssemblyKitComponent(c));
  }

  /**
   * Calculate total cost of an assembly/kit
   */
  async calculateTotalCost(itemId: string): Promise<number> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate item
    const item = await itemsRepository.findById(itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }
    
    if (item.itemType !== 'ASSEMBLY' && item.itemType !== 'KIT') {
      throw new ServiceError(
        'Item must be an assembly or kit',
        'INVALID_ITEM_TYPE',
        400
      );
    }
    
    const totalCost = await assembliesKitsRepository.calculateTotalCost(
      itemId,
      organizationId
    );
    
    return totalCost;
  }

  /**
   * Get BOM explosion (all levels)
   */
  async getBOMExplosion(
    itemId: string,
    maxDepth: number = 10
  ): Promise<any> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate item
    const item = await itemsRepository.findById(itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }
    
    if (item.itemType !== 'ASSEMBLY' && item.itemType !== 'KIT') {
      throw new ServiceError(
        'Item must be an assembly or kit',
        'INVALID_ITEM_TYPE',
        400
      );
    }
    
    const explosion = await assembliesKitsRepository.getBOMExplosion(
      itemId,
      organizationId,
      maxDepth
    );
    
    return explosion;
  }

  /**
   * Check if components are available for assembly/kit
   */
  async checkComponentAvailability(
    itemId: string,
    quantity: number = 1
  ): Promise<{
    available: boolean;
    shortages: Array<{
      componentItemId: string;
      required: number;
      available: number;
    }>;
  }> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate item
    const item = await itemsRepository.findById(itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }
    
    if (item.itemType !== 'ASSEMBLY' && item.itemType !== 'KIT') {
      throw new ServiceError(
        'Item must be an assembly or kit',
        'INVALID_ITEM_TYPE',
        400
      );
    }
    
    const availability = await assembliesKitsRepository.checkAvailability(
      itemId,
      quantity,
      organizationId
    );
    
    return availability;
  }

  /**
   * Update component display order
   */
  async updateDisplayOrder(
    parentItemId: string,
    components: Array<{ id: string; displayOrder: number }>
  ): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    
    // Validate parent item
    const parentItem = await itemsRepository.findById(parentItemId, organizationId);
    if (!parentItem) {
      throw new ServiceError(
        'Parent item not found',
        'PARENT_NOT_FOUND',
        404
      );
    }
    
    // Update display orders
    for (const component of components) {
      await assembliesKitsRepository.update(component.id, {
        displayOrder: component.displayOrder,
        updatedBy: userId,
      });
    }
  }

  /**
   * Get next display order for a parent item
   */
  private async getNextDisplayOrder(parentItemId: string): Promise<number> {
    const components = await assembliesKitsRepository.findComponentsByParent(
      parentItemId
    );
    
    if (components.length === 0) {
      return 1;
    }
    
    const maxOrder = Math.max(...components.map(c => c.displayOrder || 0));
    return maxOrder + 1;
  }

  /**
   * Validate BOM (check for issues)
   */
  async validateBOM(itemId: string): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const organizationId = this.requireOrganizationContext();
    const issues: string[] = [];
    
    // Validate item
    const item = await itemsRepository.findById(itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }
    
    if (item.itemType !== 'ASSEMBLY' && item.itemType !== 'KIT') {
      throw new ServiceError(
        'Item must be an assembly or kit',
        'INVALID_ITEM_TYPE',
        400
      );
    }
    
    // Get components
    const components = await assembliesKitsRepository.findComponentsByParent(itemId);
    
    if (components.length === 0) {
      issues.push('No components defined');
    }
    
    // Check each component
    for (const component of components) {
      const componentItem = await itemsRepository.findById(
        component.componentItemId,
        organizationId
      );
      
      if (!componentItem) {
        issues.push(`Component item ${component.componentItemId} not found`);
        continue;
      }
      
      if (!componentItem.isActive) {
        issues.push(`Component ${componentItem.name} is inactive`);
      }
      
      // Check if component is another assembly that might have circular reference
      if (componentItem.itemType === 'ASSEMBLY') {
        const hasCircular = await assembliesKitsRepository.hasCircularReference(
          itemId,
          component.componentItemId
        );
        if (hasCircular) {
          issues.push(`Circular reference detected with ${componentItem.name}`);
        }
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
    };
  }
}