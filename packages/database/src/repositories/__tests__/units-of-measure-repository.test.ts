import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { unitsOfMeasureRepository } from '../units-of-measure-repository';
import { db } from '../../db';
import { unitsOfMeasure } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('UnitsOfMeasureRepository', () => {
  const testOrganizationId = 'test-org-123';
  const testUserId = 'test-user-123';
  let createdIds: string[] = [];

  beforeEach(async () => {
    // Clean up any existing test data
    await db.delete(unitsOfMeasure)
      .where(eq(unitsOfMeasure.organizationId, testOrganizationId));
    createdIds = [];
  });

  afterEach(async () => {
    // Clean up created records
    for (const id of createdIds) {
      await db.delete(unitsOfMeasure).where(eq(unitsOfMeasure.id, id));
    }
  });

  describe('create', () => {
    it('should create a new unit of measure', async () => {
      const data = {
        organizationId: testOrganizationId,
        code: 'EA',
        name: 'Each',
        abbreviation: 'ea',
        baseConversionFactor: '1',
        decimalPlaces: 0,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      };

      const result = await unitsOfMeasureRepository.create(data);
      createdIds.push(result.id);

      expect(result).toMatchObject({
        ...data,
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should create a unit with base unit reference', async () => {
      // Create base unit first
      const baseUnit = await unitsOfMeasureRepository.create({
        organizationId: testOrganizationId,
        code: 'KG',
        name: 'Kilogram',
        abbreviation: 'kg',
        baseConversionFactor: '1',
        decimalPlaces: 2,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdIds.push(baseUnit.id);

      // Create derived unit
      const derivedUnit = await unitsOfMeasureRepository.create({
        organizationId: testOrganizationId,
        code: 'G',
        name: 'Gram',
        abbreviation: 'g',
        baseUnitId: baseUnit.id,
        baseConversionFactor: '0.001',
        decimalPlaces: 2,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdIds.push(derivedUnit.id);

      expect(derivedUnit.baseUnitId).toBe(baseUnit.id);
      expect(derivedUnit.baseConversionFactor).toBe('0.001');
    });
  });

  describe('findById', () => {
    it('should find a unit by id and organization', async () => {
      const created = await unitsOfMeasureRepository.create({
        organizationId: testOrganizationId,
        code: 'M',
        name: 'Meter',
        abbreviation: 'm',
        baseConversionFactor: '1',
        decimalPlaces: 2,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdIds.push(created.id);

      const found = await unitsOfMeasureRepository.findById(created.id, testOrganizationId);
      expect(found).toMatchObject(created);
    });

    it('should return null for wrong organization', async () => {
      const created = await unitsOfMeasureRepository.create({
        organizationId: testOrganizationId,
        code: 'L',
        name: 'Liter',
        abbreviation: 'l',
        baseConversionFactor: '1',
        decimalPlaces: 2,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdIds.push(created.id);

      const found = await unitsOfMeasureRepository.findById(created.id, 'wrong-org');
      expect(found).toBeNull();
    });
  });

  describe('findByCode', () => {
    it('should find a unit by code', async () => {
      const created = await unitsOfMeasureRepository.create({
        organizationId: testOrganizationId,
        code: 'FT',
        name: 'Foot',
        abbreviation: 'ft',
        baseConversionFactor: '1',
        decimalPlaces: 2,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdIds.push(created.id);

      const found = await unitsOfMeasureRepository.findByCode('FT', testOrganizationId);
      expect(found).toMatchObject(created);
    });
  });

  describe('calculateConversion', () => {
    it('should calculate direct conversion between units', async () => {
      // Create base unit
      const kg = await unitsOfMeasureRepository.create({
        organizationId: testOrganizationId,
        code: 'KG',
        name: 'Kilogram',
        abbreviation: 'kg',
        baseConversionFactor: '1',
        decimalPlaces: 2,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdIds.push(kg.id);

      // Create gram (1 g = 0.001 kg)
      const g = await unitsOfMeasureRepository.create({
        organizationId: testOrganizationId,
        code: 'G',
        name: 'Gram',
        abbreviation: 'g',
        baseUnitId: kg.id,
        baseConversionFactor: '0.001',
        decimalPlaces: 2,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdIds.push(g.id);

      const conversionFactor = await unitsOfMeasureRepository.calculateConversion(
        g.id,
        kg.id,
        testOrganizationId
      );

      expect(conversionFactor).toBe(0.001);
    });

    it('should calculate conversion through common base', async () => {
      // Create base unit
      const meter = await unitsOfMeasureRepository.create({
        organizationId: testOrganizationId,
        code: 'M',
        name: 'Meter',
        abbreviation: 'm',
        baseConversionFactor: '1',
        decimalPlaces: 2,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdIds.push(meter.id);

      // Create centimeter (1 cm = 0.01 m)
      const cm = await unitsOfMeasureRepository.create({
        organizationId: testOrganizationId,
        code: 'CM',
        name: 'Centimeter',
        abbreviation: 'cm',
        baseUnitId: meter.id,
        baseConversionFactor: '0.01',
        decimalPlaces: 2,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdIds.push(cm.id);

      // Create millimeter (1 mm = 0.001 m)
      const mm = await unitsOfMeasureRepository.create({
        organizationId: testOrganizationId,
        code: 'MM',
        name: 'Millimeter',
        abbreviation: 'mm',
        baseUnitId: meter.id,
        baseConversionFactor: '0.001',
        decimalPlaces: 2,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdIds.push(mm.id);

      // Convert from cm to mm (1 cm = 10 mm)
      const conversionFactor = await unitsOfMeasureRepository.calculateConversion(
        cm.id,
        mm.id,
        testOrganizationId
      );

      expect(conversionFactor).toBe(10);
    });

    it('should return null for incompatible units', async () => {
      // Create two unrelated units
      const kg = await unitsOfMeasureRepository.create({
        organizationId: testOrganizationId,
        code: 'KG',
        name: 'Kilogram',
        abbreviation: 'kg',
        baseConversionFactor: '1',
        decimalPlaces: 2,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdIds.push(kg.id);

      const meter = await unitsOfMeasureRepository.create({
        organizationId: testOrganizationId,
        code: 'M',
        name: 'Meter',
        abbreviation: 'm',
        baseConversionFactor: '1',
        decimalPlaces: 2,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdIds.push(meter.id);

      const conversionFactor = await unitsOfMeasureRepository.calculateConversion(
        kg.id,
        meter.id,
        testOrganizationId
      );

      expect(conversionFactor).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a unit of measure', async () => {
      const created = await unitsOfMeasureRepository.create({
        organizationId: testOrganizationId,
        code: 'YD',
        name: 'Yard',
        abbreviation: 'yd',
        baseConversionFactor: '1',
        decimalPlaces: 2,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });
      createdIds.push(created.id);

      const updated = await unitsOfMeasureRepository.update(
        created.id,
        testOrganizationId,
        {
          name: 'Yard (Updated)',
          abbreviation: 'yard',
        }
      );

      expect(updated).toMatchObject({
        ...created,
        name: 'Yard (Updated)',
        abbreviation: 'yard',
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('delete', () => {
    it('should soft delete a unit of measure', async () => {
      const created = await unitsOfMeasureRepository.create({
        organizationId: testOrganizationId,
        code: 'OZ',
        name: 'Ounce',
        abbreviation: 'oz',
        baseConversionFactor: '1',
        decimalPlaces: 2,
        isActive: true,
        createdBy: testUserId,
        updatedBy: testUserId,
      });

      const deleted = await unitsOfMeasureRepository.delete(created.id, testOrganizationId);
      expect(deleted).toBe(true);

      // Should not find after deletion
      const found = await unitsOfMeasureRepository.findById(created.id, testOrganizationId);
      expect(found?.isActive).toBe(false);
    });
  });
});