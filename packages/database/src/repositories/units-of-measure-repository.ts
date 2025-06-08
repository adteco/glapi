import { and, eq, ilike, or } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { unitsOfMeasure } from '../db/schema/units-of-measure';
import type { UnitsOfMeasure, NewUnitsOfMeasure } from '../db/schema/units-of-measure';

export class UnitsOfMeasureRepository extends BaseRepository {
  /**
   * Find all units of measure for an organization
   */
  async findByOrganization(organizationId: string) {
    return await this.db
      .select()
      .from(unitsOfMeasure)
      .where(eq(unitsOfMeasure.organizationId, organizationId))
      .orderBy(unitsOfMeasure.name);
  }

  /**
   * Find a unit of measure by ID
   */
  async findById(id: string, organizationId: string) {
    const results = await this.db
      .select()
      .from(unitsOfMeasure)
      .where(
        and(
          eq(unitsOfMeasure.id, id),
          eq(unitsOfMeasure.organizationId, organizationId)
        )
      );
    
    return results[0] || null;
  }

  /**
   * Find a unit of measure by code
   */
  async findByCode(code: string, organizationId: string) {
    const results = await this.db
      .select()
      .from(unitsOfMeasure)
      .where(
        and(
          eq(unitsOfMeasure.code, code),
          eq(unitsOfMeasure.organizationId, organizationId)
        )
      );
    
    return results[0] || null;
  }

  /**
   * Search units of measure by name or code
   */
  async search(query: string, organizationId: string) {
    return await this.db
      .select()
      .from(unitsOfMeasure)
      .where(
        and(
          eq(unitsOfMeasure.organizationId, organizationId),
          or(
            ilike(unitsOfMeasure.name, `%${query}%`),
            ilike(unitsOfMeasure.code, `%${query}%`)
          )
        )
      )
      .orderBy(unitsOfMeasure.name);
  }

  /**
   * Create a new unit of measure
   */
  async create(data: NewUnitsOfMeasure) {
    const results = await this.db
      .insert(unitsOfMeasure)
      .values(data)
      .returning();
    
    return results[0];
  }

  /**
   * Update a unit of measure
   */
  async update(id: string, organizationId: string, data: Partial<NewUnitsOfMeasure>) {
    const results = await this.db
      .update(unitsOfMeasure)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(unitsOfMeasure.id, id),
          eq(unitsOfMeasure.organizationId, organizationId)
        )
      )
      .returning();
    
    return results[0] || null;
  }

  /**
   * Soft delete a unit of measure
   */
  async delete(id: string, organizationId: string) {
    const results = await this.db
      .update(unitsOfMeasure)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(unitsOfMeasure.id, id),
          eq(unitsOfMeasure.organizationId, organizationId)
        )
      )
      .returning();
    
    return results[0] || null;
  }

  /**
   * Calculate conversion between two units
   * Returns the multiplier to convert from 'from' unit to 'to' unit
   */
  async calculateConversion(fromUnitId: string, toUnitId: string, organizationId: string): Promise<number | null> {
    // If same unit, conversion is 1
    if (fromUnitId === toUnitId) {
      return 1;
    }

    const fromUnit = await this.findById(fromUnitId, organizationId);
    const toUnit = await this.findById(toUnitId, organizationId);

    if (!fromUnit || !toUnit) {
      return null;
    }

    // Direct conversion if they share the same base unit
    if (fromUnit.baseUnitId === toUnit.baseUnitId && fromUnit.baseUnitId) {
      return fromUnit.baseConversionFactor / toUnit.baseConversionFactor;
    }

    // Check if one is the base unit of the other
    if (fromUnit.id === toUnit.baseUnitId) {
      return 1 / toUnit.baseConversionFactor;
    }

    if (toUnit.id === fromUnit.baseUnitId) {
      return fromUnit.baseConversionFactor;
    }

    // Complex conversion through base units
    if (fromUnit.baseUnitId && toUnit.baseUnitId) {
      const fromBase = await this.findById(fromUnit.baseUnitId, organizationId);
      const toBase = await this.findById(toUnit.baseUnitId, organizationId);

      if (fromBase && toBase && fromBase.baseUnitId === toBase.baseUnitId) {
        // Both units can be converted to the same ultimate base
        const fromToCommonBase = fromUnit.baseConversionFactor * (fromBase.baseConversionFactor || 1);
        const toToCommonBase = toUnit.baseConversionFactor * (toBase.baseConversionFactor || 1);
        return fromToCommonBase / toToCommonBase;
      }
    }

    // No conversion path found
    return null;
  }

  /**
   * Get all units that can be converted to a given unit
   */
  async getConvertibleUnits(unitId: string, organizationId: string): Promise<UnitsOfMeasure[]> {
    const unit = await this.findById(unitId, organizationId);
    if (!unit) {
      return [];
    }

    // Find all units with the same base unit (including the base unit itself)
    const baseUnitId = unit.baseUnitId || unit.id;
    
    return await this.db
      .select()
      .from(unitsOfMeasure)
      .where(
        and(
          eq(unitsOfMeasure.organizationId, organizationId),
          or(
            eq(unitsOfMeasure.id, baseUnitId),
            eq(unitsOfMeasure.baseUnitId, baseUnitId)
          )
        )
      )
      .orderBy(unitsOfMeasure.name);
  }
}