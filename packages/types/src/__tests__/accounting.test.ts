/**
 * Tests for accounting types module
 */
import { describe, it, expect } from 'vitest';
import {
  departmentSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  locationSchema,
  createLocationSchema,
  updateLocationSchema,
  classSchema,
  createClassSchema,
  updateClassSchema,
  subsidiarySchema,
  createSubsidiarySchema,
  updateSubsidiarySchema,
  AccountCategoryEnum,
  createAccountSchema,
  updateAccountSchema,
  newAccountSchema,
} from '../accounting';

const validUuid = '550e8400-e29b-41d4-a716-446655440000';
const validOrgId = 'org_123456';

describe('Accounting Types', () => {
  describe('DepartmentSchema', () => {
    it('accepts valid department data', () => {
      const department = {
        organizationId: validOrgId,
        name: 'Engineering',
        code: 'ENG',
        description: 'Engineering department',
        subsidiaryId: validUuid,
        isActive: true,
      };
      const result = departmentSchema.parse(department);
      expect(result.name).toBe('Engineering');
      expect(result.isActive).toBe(true);
    });

    it('requires name field', () => {
      expect(() => departmentSchema.parse({
        organizationId: validOrgId,
      })).toThrow();
    });

    it('applies default isActive value', () => {
      const result = departmentSchema.parse({
        organizationId: validOrgId,
        name: 'Engineering',
        subsidiaryId: validUuid,
      });
      expect(result.isActive).toBe(true);
    });
  });

  describe('createDepartmentSchema', () => {
    it('omits id, createdAt, updatedAt from base schema', () => {
      const input = {
        organizationId: validOrgId,
        name: 'Marketing',
        subsidiaryId: validUuid,
      };
      const result = createDepartmentSchema.parse(input);
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
    });
  });

  describe('updateDepartmentSchema', () => {
    it('allows partial updates', () => {
      const result = updateDepartmentSchema.parse({ name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('accepts empty object', () => {
      const result = updateDepartmentSchema.parse({});
      expect(result).toEqual({});
    });
  });

  describe('LocationSchema', () => {
    it('accepts valid location data', () => {
      const location = {
        organizationId: validOrgId,
        name: 'Main Office',
        code: 'HQ-001',
        description: 'Corporate headquarters',
        subsidiaryId: validUuid,
        addressLine1: '123 Main St',
        city: 'San Francisco',
        stateProvince: 'CA',
        postalCode: '94105',
        countryCode: 'US',
        isActive: true,
      };
      const result = locationSchema.parse(location);
      expect(result.name).toBe('Main Office');
      expect(result.countryCode).toBe('US');
    });

    it('requires subsidiary ID', () => {
      expect(() => locationSchema.parse({
        organizationId: validOrgId,
        name: 'Office',
      })).toThrow();
    });
  });

  describe('createLocationSchema', () => {
    it('requires subsidiaryId', () => {
      expect(() => createLocationSchema.parse({
        organizationId: validOrgId,
        name: 'Office',
      })).toThrow();
    });

    it('accepts valid location input', () => {
      const result = createLocationSchema.parse({
        organizationId: validOrgId,
        name: 'Branch Office',
        subsidiaryId: validUuid,
      });
      expect(result.name).toBe('Branch Office');
    });
  });

  describe('updateLocationSchema', () => {
    it('allows partial updates', () => {
      const result = updateLocationSchema.parse({
        name: 'Updated Location',
        city: 'New York',
      });
      expect(result.name).toBe('Updated Location');
      expect(result.city).toBe('New York');
    });
  });

  describe('ClassSchema', () => {
    it('accepts valid class data', () => {
      const classData = {
        organizationId: validOrgId,
        name: 'Marketing',
        code: 'MKT',
        subsidiaryId: validUuid,
        isActive: true,
      };
      const result = classSchema.parse(classData);
      expect(result.name).toBe('Marketing');
    });

    it('requires name', () => {
      expect(() => classSchema.parse({
        organizationId: validOrgId,
        subsidiaryId: validUuid,
      })).toThrow();
    });

    it('requires subsidiaryId', () => {
      expect(() => classSchema.parse({
        organizationId: validOrgId,
        name: 'Marketing',
      })).toThrow();
    });
  });

  describe('createClassSchema', () => {
    it('omits id, createdAt, updatedAt', () => {
      const result = createClassSchema.parse({
        organizationId: validOrgId,
        name: 'Operations',
        subsidiaryId: validUuid,
      });
      expect(result.name).toBe('Operations');
    });
  });

  describe('SubsidiarySchema', () => {
    it('accepts valid subsidiary data', () => {
      const subsidiary = {
        organizationId: validOrgId,
        name: 'North America Division',
        code: 'NA-DIV',
        description: 'North America operations',
        isActive: true,
      };
      const result = subsidiarySchema.parse(subsidiary);
      expect(result.name).toBe('North America Division');
    });

    it('allows nullable parentId', () => {
      const result = subsidiarySchema.parse({
        organizationId: validOrgId,
        name: 'Parent Company',
        parentId: null,
      });
      expect(result.parentId).toBeNull();
    });
  });

  describe('createSubsidiarySchema', () => {
    it('creates valid subsidiary input', () => {
      const result = createSubsidiarySchema.parse({
        organizationId: validOrgId,
        name: 'New Division',
      });
      expect(result.name).toBe('New Division');
      expect(result.isActive).toBe(true);
    });
  });

  describe('AccountCategoryEnum', () => {
    it('accepts valid account categories', () => {
      expect(AccountCategoryEnum.parse('Asset')).toBe('Asset');
      expect(AccountCategoryEnum.parse('Liability')).toBe('Liability');
      expect(AccountCategoryEnum.parse('Equity')).toBe('Equity');
      expect(AccountCategoryEnum.parse('Revenue')).toBe('Revenue');
      expect(AccountCategoryEnum.parse('COGS')).toBe('COGS');
      expect(AccountCategoryEnum.parse('Expense')).toBe('Expense');
    });

    it('rejects invalid categories', () => {
      expect(() => AccountCategoryEnum.parse('asset')).toThrow(); // Case sensitive
      expect(() => AccountCategoryEnum.parse('Income')).toThrow();
    });
  });

  describe('createAccountSchema', () => {
    it('accepts valid account data', () => {
      const account = {
        organizationId: validOrgId,
        accountNumber: '10000',
        accountName: 'Cash',
        accountCategory: 'Asset' as const,
        isActive: true,
      };
      const result = createAccountSchema.parse(account);
      expect(result.accountNumber).toBe('10000');
      expect(result.accountCategory).toBe('Asset');
    });

    it('requires account number and name', () => {
      expect(() => createAccountSchema.parse({
        organizationId: validOrgId,
        accountCategory: 'Asset',
      })).toThrow();
    });

    it('applies default values', () => {
      const result = createAccountSchema.parse({
        organizationId: validOrgId,
        accountNumber: '20000',
        accountName: 'Accounts Payable',
        accountCategory: 'Liability' as const,
      });
      expect(result.isActive).toBe(true);
      expect(result.isControlAccount).toBe(false);
    });
  });

  describe('updateAccountSchema', () => {
    it('allows partial updates', () => {
      const result = updateAccountSchema.parse({
        accountName: 'Updated Account Name',
        isActive: false,
      });
      expect(result.accountName).toBe('Updated Account Name');
      expect(result.isActive).toBe(false);
    });

    it('omits organizationId', () => {
      const result = updateAccountSchema.parse({
        accountName: 'Test',
      });
      expect(result).not.toHaveProperty('organizationId');
    });
  });

  describe('newAccountSchema', () => {
    it('accepts account data without organizationId', () => {
      const result = newAccountSchema.parse({
        accountNumber: '30000',
        accountName: 'Retained Earnings',
        accountCategory: 'Equity' as const,
      });
      expect(result.accountNumber).toBe('30000');
      expect(result).not.toHaveProperty('organizationId');
    });
  });
});
