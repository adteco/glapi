import { BaseService } from './base-service';
import { 
  UnitsOfMeasure,
  CreateUnitsOfMeasureInput,
  UpdateUnitsOfMeasureInput,
  createUnitsOfMeasureSchema,
  updateUnitsOfMeasureSchema,
  ServiceError,
  PaginatedResult,
  PaginationParams
} from '../types';
import { unitsOfMeasureRepository } from '@glapi/database';

export class UnitsOfMeasureService extends BaseService {
  /**
   * Transform database record to service layer type
   */
  private transformUnitsOfMeasure(dbRecord: any): UnitsOfMeasure {
    return {
      id: dbRecord.id,
      organizationId: dbRecord.organizationId,
      code: dbRecord.code,
      name: dbRecord.name,
      abbreviation: dbRecord.abbreviation,
      baseUnitId: dbRecord.baseUnitId,
      baseConversionFactor: parseFloat(dbRecord.baseConversionFactor),
      decimalPlaces: dbRecord.decimalPlaces,
      isActive: dbRecord.isActive,
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
    };
  }

  /**
   * Get all units of measure for the organization
   */
  async listUnitsOfMeasure(
    params: PaginationParams = {}
  ): Promise<PaginatedResult<UnitsOfMeasure>> {
    const organizationId = this.requireOrganizationContext();
    const { page, limit } = this.getPaginationParams(params);
    
    const units = await unitsOfMeasureRepository.findByOrganization(organizationId);
    
    // Manual pagination
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const paginatedData = units.slice(startIdx, endIdx);
    
    return this.createPaginatedResult(
      paginatedData.map(u => this.transformUnitsOfMeasure(u)),
      units.length,
      page,
      limit
    );
  }

  /**
   * Get a unit of measure by ID
   */
  async getUnitsOfMeasure(id: string): Promise<UnitsOfMeasure> {
    const organizationId = this.requireOrganizationContext();
    
    const unit = await unitsOfMeasureRepository.findById(id, organizationId);
    if (!unit) {
      throw new ServiceError(
        'Unit of measure not found',
        'UNIT_NOT_FOUND',
        404
      );
    }
    
    return this.transformUnitsOfMeasure(unit);
  }

  /**
   * Create a new unit of measure
   */
  async createUnitsOfMeasure(
    input: CreateUnitsOfMeasureInput
  ): Promise<UnitsOfMeasure> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    
    // Validate input
    const validatedInput = createUnitsOfMeasureSchema.parse(input);
    
    // Check if code already exists
    const existing = await unitsOfMeasureRepository.findByCode(
      validatedInput.code,
      organizationId
    );
    if (existing) {
      throw new ServiceError(
        'Unit of measure with this code already exists',
        'DUPLICATE_CODE',
        409
      );
    }
    
    // Validate base unit if provided
    if (validatedInput.baseUnitId) {
      const baseUnit = await unitsOfMeasureRepository.findById(
        validatedInput.baseUnitId,
        organizationId
      );
      if (!baseUnit) {
        throw new ServiceError(
          'Base unit not found',
          'INVALID_BASE_UNIT',
          400
        );
      }
      
      // Prevent circular reference
      if (baseUnit.baseUnitId === validatedInput.baseUnitId) {
        throw new ServiceError(
          'Circular reference detected in base unit',
          'CIRCULAR_REFERENCE',
          400
        );
      }
    }
    
    const created = await unitsOfMeasureRepository.create({
      organizationId,
      code: validatedInput.code,
      name: validatedInput.name,
      abbreviation: validatedInput.abbreviation,
      baseUnitId: validatedInput.baseUnitId,
      baseConversionFactor: validatedInput.baseConversionFactor.toString(),
      decimalPlaces: validatedInput.decimalPlaces,
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    });
    
    return this.transformUnitsOfMeasure(created);
  }

  /**
   * Update a unit of measure
   */
  async updateUnitsOfMeasure(
    id: string,
    input: UpdateUnitsOfMeasureInput
  ): Promise<UnitsOfMeasure> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    
    // Validate input
    const validatedInput = updateUnitsOfMeasureSchema.parse(input);
    
    // Check if unit exists
    const existing = await unitsOfMeasureRepository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError(
        'Unit of measure not found',
        'UNIT_NOT_FOUND',
        404
      );
    }
    
    // Check if code is being changed and already exists
    if (validatedInput.code && validatedInput.code !== existing.code) {
      const codeExists = await unitsOfMeasureRepository.findByCode(
        validatedInput.code,
        organizationId
      );
      if (codeExists) {
        throw new ServiceError(
          'Unit of measure with this code already exists',
          'DUPLICATE_CODE',
          409
        );
      }
    }
    
    // Validate base unit if being changed
    if (validatedInput.baseUnitId !== undefined) {
      if (validatedInput.baseUnitId) {
        const baseUnit = await unitsOfMeasureRepository.findById(
          validatedInput.baseUnitId,
          organizationId
        );
        if (!baseUnit) {
          throw new ServiceError(
            'Base unit not found',
            'INVALID_BASE_UNIT',
            400
          );
        }
        
        // Prevent circular reference
        if (validatedInput.baseUnitId === id) {
          throw new ServiceError(
            'A unit cannot be its own base unit',
            'CIRCULAR_REFERENCE',
            400
          );
        }
      }
    }
    
    const updateData: any = {
      ...validatedInput,
      updatedBy: userId,
    };
    
    if (validatedInput.baseConversionFactor !== undefined) {
      updateData.baseConversionFactor = validatedInput.baseConversionFactor.toString();
    }
    
    const updated = await unitsOfMeasureRepository.update(
      id,
      organizationId,
      updateData
    );
    
    if (!updated) {
      throw new ServiceError(
        'Failed to update unit of measure',
        'UPDATE_FAILED',
        500
      );
    }
    
    return this.transformUnitsOfMeasure(updated);
  }

  /**
   * Delete (deactivate) a unit of measure
   */
  async deleteUnitsOfMeasure(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    // Check if unit exists
    const existing = await unitsOfMeasureRepository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError(
        'Unit of measure not found',
        'UNIT_NOT_FOUND',
        404
      );
    }
    
    // Check if unit is used as base unit
    const dependentUnits = await unitsOfMeasureRepository.findByOrganization(
      organizationId
    );
    const hasDependent = dependentUnits.some(u => u.baseUnitId === id);
    
    if (hasDependent) {
      throw new ServiceError(
        'Cannot delete unit that is used as base unit for other units',
        'HAS_DEPENDENT_UNITS',
        409
      );
    }
    
    // TODO: Check if unit is used in items
    
    const deleted = await unitsOfMeasureRepository.delete(id, organizationId);
    if (!deleted) {
      throw new ServiceError(
        'Failed to delete unit of measure',
        'DELETE_FAILED',
        500
      );
    }
  }

  /**
   * Convert a quantity from one unit to another
   */
  async convertQuantity(
    fromUnitId: string,
    toUnitId: string,
    quantity: number
  ): Promise<number> {
    const organizationId = this.requireOrganizationContext();
    
    const conversionFactor = await unitsOfMeasureRepository.calculateConversion(
      fromUnitId,
      toUnitId,
      organizationId
    );
    
    if (conversionFactor === null) {
      throw new ServiceError(
        'No conversion path found between units',
        'NO_CONVERSION_PATH',
        400
      );
    }
    
    return quantity * conversionFactor;
  }

  /**
   * Get all units that can be converted to/from a given unit
   */
  async getConvertibleUnits(unitId: string): Promise<UnitsOfMeasure[]> {
    const organizationId = this.requireOrganizationContext();
    
    const units = await unitsOfMeasureRepository.getConvertibleUnits(
      unitId,
      organizationId
    );
    
    return units.map(u => this.transformUnitsOfMeasure(u));
  }

  /**
   * Search units of measure
   */
  async searchUnitsOfMeasure(query: string): Promise<UnitsOfMeasure[]> {
    const organizationId = this.requireOrganizationContext();
    
    const units = await unitsOfMeasureRepository.search(query, organizationId);
    
    return units.map(u => this.transformUnitsOfMeasure(u));
  }
}