/**
 * Tests for entity types module
 */
import { describe, it, expect } from 'vitest';
import {
  baseEntitySchema,
  createEntitySchema,
  updateEntitySchema,
  customerSchema,
  createCustomerSchema,
  updateCustomerSchema,
  EntityTypeEnum,
  EmploymentTypeEnum,
  EntityStatusEnum,
} from '../entities';

const validUuid = '550e8400-e29b-41d4-a716-446655440000';
const validOrgId = 'org_123456';

describe('Entity Types', () => {
  describe('EntityTypeEnum', () => {
    it('accepts valid entity types', () => {
      expect(EntityTypeEnum.parse('Customer')).toBe('Customer');
      expect(EntityTypeEnum.parse('Vendor')).toBe('Vendor');
      expect(EntityTypeEnum.parse('Employee')).toBe('Employee');
      expect(EntityTypeEnum.parse('Partner')).toBe('Partner');
      expect(EntityTypeEnum.parse('Lead')).toBe('Lead');
      expect(EntityTypeEnum.parse('Prospect')).toBe('Prospect');
      expect(EntityTypeEnum.parse('Contact')).toBe('Contact');
    });

    it('rejects invalid entity types', () => {
      expect(() => EntityTypeEnum.parse('customer')).toThrow(); // Case sensitive
      expect(() => EntityTypeEnum.parse('Supplier')).toThrow();
    });
  });

  describe('EmploymentTypeEnum', () => {
    it('accepts valid employment types', () => {
      expect(EmploymentTypeEnum.parse('full-time')).toBe('full-time');
      expect(EmploymentTypeEnum.parse('part-time')).toBe('part-time');
      expect(EmploymentTypeEnum.parse('contractor')).toBe('contractor');
      expect(EmploymentTypeEnum.parse('intern')).toBe('intern');
    });

    it('rejects invalid employment types', () => {
      expect(() => EmploymentTypeEnum.parse('fulltime')).toThrow();
      expect(() => EmploymentTypeEnum.parse('full_time')).toThrow();
    });
  });

  describe('EntityStatusEnum', () => {
    it('accepts valid status values', () => {
      expect(EntityStatusEnum.parse('active')).toBe('active');
      expect(EntityStatusEnum.parse('inactive')).toBe('inactive');
      expect(EntityStatusEnum.parse('archived')).toBe('archived');
    });

    it('rejects invalid status values', () => {
      expect(() => EntityStatusEnum.parse('pending')).toThrow();
    });
  });

  describe('baseEntitySchema', () => {
    const now = new Date().toISOString();

    it('accepts valid entity data with all required fields', () => {
      const entity = {
        id: validUuid,
        organizationId: validOrgId,
        name: 'Acme Corp',
        entityTypes: ['Customer'],
        status: 'active' as const,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      const result = baseEntitySchema.parse(entity);
      expect(result.name).toBe('Acme Corp');
      expect(result.entityTypes).toContain('Customer');
    });

    it('requires id, createdAt, updatedAt', () => {
      expect(() => baseEntitySchema.parse({
        organizationId: validOrgId,
        name: 'Test Entity',
        entityTypes: ['Customer'],
      })).toThrow();
    });

    it('applies default status', () => {
      const result = baseEntitySchema.parse({
        id: validUuid,
        organizationId: validOrgId,
        name: 'Test Entity',
        entityTypes: ['Vendor'],
        createdAt: now,
        updatedAt: now,
      });
      expect(result.status).toBe('active');
    });

    it('accepts optional address', () => {
      const result = baseEntitySchema.parse({
        id: validUuid,
        organizationId: validOrgId,
        name: 'Test Entity',
        entityTypes: ['Customer'],
        createdAt: now,
        updatedAt: now,
        address: {
          line1: '123 Main St',
          city: 'San Francisco',
        },
      });
      expect(result.address?.line1).toBe('123 Main St');
    });
  });

  describe('createEntitySchema', () => {
    it('omits id, createdAt, updatedAt', () => {
      const result = createEntitySchema.parse({
        organizationId: validOrgId,
        name: 'New Entity',
        entityTypes: ['Lead'],
      });
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
    });
  });

  describe('updateEntitySchema', () => {
    it('allows partial updates', () => {
      const result = updateEntitySchema.parse({
        name: 'Updated Entity Name',
        status: 'inactive' as const,
      });
      expect(result.name).toBe('Updated Entity Name');
      expect(result.status).toBe('inactive');
    });

    it('accepts empty object for no updates', () => {
      const result = updateEntitySchema.parse({});
      expect(result).toEqual({});
    });
  });

  describe('customerSchema', () => {
    it('accepts valid customer data', () => {
      const customer = {
        organizationId: validOrgId,
        companyName: 'Acme Corp',
        customerId: 'CUST-001',
        contactEmail: 'contact@acme.com',
        contactPhone: '+1-555-1234',
        status: 'active' as const,
      };
      const result = customerSchema.parse(customer);
      expect(result.companyName).toBe('Acme Corp');
      expect(result.contactEmail).toBe('contact@acme.com');
    });

    it('requires companyName', () => {
      expect(() => customerSchema.parse({
        organizationId: validOrgId,
      })).toThrow();
    });

    it('accepts empty string for optional email', () => {
      const result = customerSchema.parse({
        organizationId: validOrgId,
        companyName: 'Test Corp',
        contactEmail: '',
      });
      expect(result.contactEmail).toBe('');
    });

    it('validates email format when provided', () => {
      expect(() => customerSchema.parse({
        organizationId: validOrgId,
        companyName: 'Test Corp',
        contactEmail: 'not-an-email',
      })).toThrow();
    });

    it('accepts billing address', () => {
      const result = customerSchema.parse({
        organizationId: validOrgId,
        companyName: 'Test Corp',
        billingAddress: {
          street: '456 Oak Ave',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'United States',
        },
      });
      expect(result.billingAddress?.city).toBe('New York');
    });
  });

  describe('createCustomerSchema', () => {
    it('omits id, createdAt, updatedAt', () => {
      const result = createCustomerSchema.parse({
        organizationId: validOrgId,
        companyName: 'New Customer',
      });
      expect(result.companyName).toBe('New Customer');
      expect(result).not.toHaveProperty('id');
    });
  });

  describe('updateCustomerSchema', () => {
    it('allows partial updates without organizationId', () => {
      const result = updateCustomerSchema.parse({
        companyName: 'Updated Name',
        contactPhone: '555-9999',
      });
      expect(result.companyName).toBe('Updated Name');
      expect(result).not.toHaveProperty('organizationId');
    });

    it('validates status when provided', () => {
      const result = updateCustomerSchema.parse({
        status: 'inactive' as const,
      });
      expect(result.status).toBe('inactive');

      expect(() => updateCustomerSchema.parse({
        status: 'invalid',
      })).toThrow();
    });
  });
});
