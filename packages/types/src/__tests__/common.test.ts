/**
 * Tests for common types module
 */
import { describe, it, expect } from 'vitest';
import {
  emptyStringToUndefined,
  emptyStringToNull,
  optionalUuidSchema,
  dateStringSchema,
  dateRangeSchema,
  decimalStringSchema,
  rateStringSchema,
  currencyStringSchema,
  paginationInputSchema,
  uuidSchema,
  addressSchema,
  requiredAddressSchema,
  sortDirectionSchema,
  phoneSchema,
  emailSchema,
  activeStatusSchema,
  recordStatusSchema,
} from '../common';
import { z } from 'zod';

describe('Common Types', () => {
  describe('emptyStringToUndefined', () => {
    it('converts empty strings to undefined', () => {
      const schema = emptyStringToUndefined(z.string().optional());
      expect(schema.parse('')).toBeUndefined();
    });

    it('passes through non-empty strings', () => {
      const schema = emptyStringToUndefined(z.string().optional());
      expect(schema.parse('test')).toBe('test');
    });
  });

  describe('emptyStringToNull', () => {
    it('converts empty strings to null', () => {
      const schema = emptyStringToNull(z.string().nullable());
      expect(schema.parse('')).toBeNull();
    });

    it('passes through non-empty strings', () => {
      const schema = emptyStringToNull(z.string().nullable());
      expect(schema.parse('test')).toBe('test');
    });
  });

  describe('uuidSchema', () => {
    it('accepts valid UUIDs', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(uuidSchema.parse(validUuid)).toBe(validUuid);
    });

    it('rejects invalid UUIDs', () => {
      expect(() => uuidSchema.parse('not-a-uuid')).toThrow();
      expect(() => uuidSchema.parse('12345')).toThrow();
    });
  });

  describe('optionalUuidSchema', () => {
    it('accepts valid UUIDs', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(optionalUuidSchema.parse(validUuid)).toBe(validUuid);
    });

    it('converts empty string to undefined', () => {
      expect(optionalUuidSchema.parse('')).toBeUndefined();
    });

    it('accepts undefined', () => {
      expect(optionalUuidSchema.parse(undefined)).toBeUndefined();
    });
  });

  describe('dateStringSchema', () => {
    it('accepts valid date strings', () => {
      expect(dateStringSchema.parse('2024-01-15')).toBe('2024-01-15');
      expect(dateStringSchema.parse('2024-12-31')).toBe('2024-12-31');
    });

    it('rejects invalid date formats', () => {
      expect(() => dateStringSchema.parse('01-15-2024')).toThrow();
      expect(() => dateStringSchema.parse('2024/01/15')).toThrow();
      expect(() => dateStringSchema.parse('2024-1-15')).toThrow();
    });
  });

  describe('dateRangeSchema', () => {
    it('accepts valid date ranges', () => {
      const result = dateRangeSchema.parse({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      expect(result.startDate).toBe('2024-01-01');
      expect(result.endDate).toBe('2024-12-31');
    });

    it('accepts partial date ranges', () => {
      expect(dateRangeSchema.parse({ startDate: '2024-01-01' })).toEqual({
        startDate: '2024-01-01',
      });
      expect(dateRangeSchema.parse({})).toEqual({});
    });
  });

  describe('decimalStringSchema', () => {
    it('accepts valid decimal strings', () => {
      expect(decimalStringSchema.parse('100')).toBe('100');
      expect(decimalStringSchema.parse('100.5')).toBe('100.5');
      expect(decimalStringSchema.parse('100.25')).toBe('100.25');
    });

    it('rejects invalid decimal strings', () => {
      expect(() => decimalStringSchema.parse('100.123')).toThrow(); // Too many decimals
      expect(() => decimalStringSchema.parse('-100')).toThrow(); // Negative
      expect(() => decimalStringSchema.parse('abc')).toThrow();
    });
  });

  describe('rateStringSchema', () => {
    it('accepts valid rate strings', () => {
      expect(rateStringSchema.parse('100')).toBe('100');
      expect(rateStringSchema.parse('100.5')).toBe('100.5');
      expect(rateStringSchema.parse('100.1234')).toBe('100.1234');
    });

    it('rejects invalid rate strings', () => {
      expect(() => rateStringSchema.parse('100.12345')).toThrow(); // Too many decimals
      expect(() => rateStringSchema.parse('-100')).toThrow(); // Negative
    });
  });

  describe('currencyStringSchema', () => {
    it('accepts valid currency values', () => {
      expect(currencyStringSchema.parse('100')).toBe('100');
      expect(currencyStringSchema.parse('100.99')).toBe('100.99');
      expect(currencyStringSchema.parse('-100.50')).toBe('-100.50'); // Negative allowed
    });

    it('rejects invalid currency values', () => {
      expect(() => currencyStringSchema.parse('100.999')).toThrow(); // Too many decimals
      expect(() => currencyStringSchema.parse('abc')).toThrow();
    });
  });

  describe('paginationInputSchema', () => {
    it('applies default values', () => {
      const result = paginationInputSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });

    it('accepts custom values', () => {
      const result = paginationInputSchema.parse({ page: 2, limit: 25 });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(25);
    });

    it('rejects invalid pagination values', () => {
      expect(() => paginationInputSchema.parse({ page: 0 })).toThrow(); // Not positive
      expect(() => paginationInputSchema.parse({ limit: 101 })).toThrow(); // Exceeds max
      expect(() => paginationInputSchema.parse({ page: -1 })).toThrow();
    });
  });

  describe('addressSchema', () => {
    it('accepts valid addresses', () => {
      const address = {
        street: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
        country: 'United States',
      };
      expect(addressSchema.parse(address)).toEqual(address);
    });

    it('accepts partial addresses', () => {
      expect(addressSchema.parse({ city: 'San Francisco' })).toEqual({
        city: 'San Francisco',
      });
      expect(addressSchema.parse({})).toEqual({});
    });
  });

  describe('requiredAddressSchema', () => {
    it('requires all address fields', () => {
      const address = {
        street: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
        country: 'United States',
      };
      expect(requiredAddressSchema.parse(address)).toEqual(address);
    });

    it('rejects partial addresses', () => {
      expect(() => requiredAddressSchema.parse({ city: 'San Francisco' })).toThrow();
    });
  });

  describe('activeStatusSchema', () => {
    it('accepts valid status values', () => {
      expect(activeStatusSchema.parse('ACTIVE')).toBe('ACTIVE');
      expect(activeStatusSchema.parse('INACTIVE')).toBe('INACTIVE');
    });

    it('rejects invalid status values', () => {
      expect(() => activeStatusSchema.parse('active')).toThrow();
      expect(() => activeStatusSchema.parse('ARCHIVED')).toThrow();
    });
  });

  describe('recordStatusSchema', () => {
    it('accepts valid status values', () => {
      expect(recordStatusSchema.parse('ACTIVE')).toBe('ACTIVE');
      expect(recordStatusSchema.parse('INACTIVE')).toBe('INACTIVE');
      expect(recordStatusSchema.parse('ARCHIVED')).toBe('ARCHIVED');
    });

    it('rejects invalid status values', () => {
      expect(() => recordStatusSchema.parse('active')).toThrow();
    });
  });

  describe('sortDirectionSchema', () => {
    it('accepts valid sort directions', () => {
      expect(sortDirectionSchema.parse('asc')).toBe('asc');
      expect(sortDirectionSchema.parse('desc')).toBe('desc');
    });

    it('rejects invalid sort directions', () => {
      expect(() => sortDirectionSchema.parse('ascending')).toThrow();
      expect(() => sortDirectionSchema.parse('ASC')).toThrow();
    });
  });

  describe('phoneSchema', () => {
    it('accepts valid phone numbers', () => {
      expect(phoneSchema.parse('555-1234')).toBe('555-1234');
      expect(phoneSchema.parse('+1 (555) 123-4567')).toBe('+1 (555) 123-4567');
    });

    it('accepts undefined (optional)', () => {
      expect(phoneSchema.parse(undefined)).toBeUndefined();
    });

    it('rejects phone numbers exceeding max length', () => {
      const tooLong = 'a'.repeat(51);
      expect(() => phoneSchema.parse(tooLong)).toThrow();
    });
  });

  describe('emailSchema', () => {
    it('accepts valid emails', () => {
      expect(emailSchema.parse('test@example.com')).toBe('test@example.com');
    });

    it('rejects invalid emails', () => {
      expect(() => emailSchema.parse('not-an-email')).toThrow();
      expect(() => emailSchema.parse('missing@domain')).toThrow();
    });
  });
});
