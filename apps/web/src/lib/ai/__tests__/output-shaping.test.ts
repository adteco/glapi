/**
 * Tests for Output Shaping and Redaction
 *
 * These tests ensure that sensitive data is properly redacted and that
 * output shaping works as expected.
 *
 * CRITICAL: Tests verify that PII fields are never leaked in tool responses.
 */

import { describe, it, expect } from 'vitest';
import {
  applyOutputShaping,
  hasOutputConfig,
  mergeOutputConfigs,
  type OutputConfig,
} from '../output-shaping';

describe('Output Shaping', () => {
  describe('applyOutputShaping', () => {
    describe('with no config', () => {
      it('should apply default PII redaction', () => {
        const data = {
          id: '123',
          name: 'John Doe',
          password: 'secret123',
          apiKey: 'key-abc-123',
        };

        const result = applyOutputShaping(data);

        expect(result.data.id).toBe('123');
        expect(result.data.name).toBe('John Doe');
        expect(result.data.password).toBe('[REDACTED]');
        expect(result.data.apiKey).toBe('[REDACTED]');
        expect(result.stats.fieldsRedacted).toBe(2);
      });

      it('should redact nested PII fields', () => {
        const data = {
          user: {
            name: 'Jane',
            credentials: {
              password: 'secret',
              token: 'abc123',
            },
          },
        };

        const result = applyOutputShaping(data);

        expect(result.data.user.name).toBe('Jane');
        expect(result.data.user.credentials.password).toBe('[REDACTED]');
        expect(result.data.user.credentials.token).toBe('[REDACTED]');
      });

      it('should redact SSN and credit card fields', () => {
        const data = {
          customer: 'ACME Corp',
          ssn: '123-45-6789',
          socialSecurityNumber: '987-65-4321',
          creditCardNumber: '4111111111111111',
          cvv: '123',
        };

        const result = applyOutputShaping(data);

        expect(result.data.customer).toBe('ACME Corp');
        expect(result.data.ssn).toBe('[REDACTED]');
        expect(result.data.socialSecurityNumber).toBe('[REDACTED]');
        expect(result.data.creditCardNumber).toBe('[REDACTED]');
        expect(result.data.cvv).toBe('[REDACTED]');
      });
    });

    describe('with includeFields', () => {
      it('should only include specified fields', () => {
        const data = {
          id: '123',
          name: 'Test Customer',
          email: 'test@example.com',
          internalNotes: 'Secret notes',
          balance: 1000,
        };

        const config: OutputConfig = {
          includeFields: ['id', 'name', 'balance'],
        };

        const result = applyOutputShaping(data, config);

        expect(result.data).toEqual({
          id: '123',
          name: 'Test Customer',
          balance: 1000,
        });
        expect(result.data.email).toBeUndefined();
        expect(result.data.internalNotes).toBeUndefined();
        expect(result.stats.fieldsIncluded).toBe(3);
      });

      it('should support dot notation for nested fields', () => {
        const data = {
          customer: {
            id: '123',
            name: 'ACME',
            contact: {
              email: 'acme@example.com',
              phone: '555-1234',
            },
          },
          total: 500,
        };

        const config: OutputConfig = {
          includeFields: ['customer.id', 'customer.name', 'total'],
        };

        const result = applyOutputShaping(data, config);

        expect(result.data.customer.id).toBe('123');
        expect(result.data.customer.name).toBe('ACME');
        expect(result.data.total).toBe(500);
        expect(result.data.customer.contact).toBeUndefined();
      });

      it('should filter arrays of objects', () => {
        const data = [
          { id: '1', name: 'Item 1', secret: 'hidden' },
          { id: '2', name: 'Item 2', secret: 'hidden' },
        ];

        const config: OutputConfig = {
          includeFields: ['id', 'name'],
        };

        const result = applyOutputShaping(data, config);

        expect(result.data).toEqual([
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' },
        ]);
      });
    });

    describe('with redactFields', () => {
      it('should redact specified fields', () => {
        const data = {
          id: '123',
          name: 'Customer',
          taxId: '12-3456789',
          bankAccount: '123456789',
        };

        const config: OutputConfig = {
          redactFields: ['taxId', 'bankAccount'],
        };

        const result = applyOutputShaping(data, config);

        expect(result.data.id).toBe('123');
        expect(result.data.name).toBe('Customer');
        expect(result.data.taxId).toBe('[REDACTED]');
        expect(result.data.bankAccount).toBe('[REDACTED]');
        expect(result.stats.fieldsRedacted).toBe(2);
      });

      it('should redact nested fields using dot notation', () => {
        const data = {
          vendor: {
            name: 'Supplier Inc',
            banking: {
              accountNumber: '123456',
              routingNumber: '987654',
            },
          },
        };

        const config: OutputConfig = {
          redactFields: ['vendor.banking.accountNumber', 'vendor.banking.routingNumber'],
        };

        const result = applyOutputShaping(data, config);

        expect(result.data.vendor.name).toBe('Supplier Inc');
        expect(result.data.vendor.banking.accountNumber).toBe('[REDACTED]');
        expect(result.data.vendor.banking.routingNumber).toBe('[REDACTED]');
      });

      it('should redact fields in arrays', () => {
        const data = [
          { id: '1', ssn: '111-11-1111' },
          { id: '2', ssn: '222-22-2222' },
        ];

        const config: OutputConfig = {
          redactFields: ['ssn'],
        };

        const result = applyOutputShaping(data, config);

        expect(result.data[0].id).toBe('1');
        expect(result.data[0].ssn).toBe('[REDACTED]');
        expect(result.data[1].id).toBe('2');
        expect(result.data[1].ssn).toBe('[REDACTED]');
      });
    });

    describe('with maxItems', () => {
      it('should limit array to maxItems', () => {
        const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

        const config: OutputConfig = {
          maxItems: 5,
        };

        const result = applyOutputShaping(data, config);

        expect(result.data).toEqual([1, 2, 3, 4, 5]);
        expect(result.stats.itemsLimited).toBe(5);
      });

      it('should limit nested arrays', () => {
        const data = {
          customers: [
            { id: '1' },
            { id: '2' },
            { id: '3' },
            { id: '4' },
            { id: '5' },
          ],
        };

        const config: OutputConfig = {
          maxItems: 3,
        };

        const result = applyOutputShaping(data, config);

        expect(result.data.customers.length).toBe(3);
        expect(result.stats.itemsLimited).toBe(2);
      });

      it('should not limit arrays smaller than maxItems', () => {
        const data = [1, 2, 3];

        const config: OutputConfig = {
          maxItems: 10,
        };

        const result = applyOutputShaping(data, config);

        expect(result.data).toEqual([1, 2, 3]);
        expect(result.stats.itemsLimited).toBe(0);
      });
    });

    describe('with maxTokens', () => {
      it('should truncate long strings', () => {
        const longText = 'A'.repeat(10000);
        const data = { content: longText };

        const config: OutputConfig = {
          maxTokens: 100, // ~400 chars
        };

        const result = applyOutputShaping(data, config);

        expect(result.data.content.length).toBeLessThan(longText.length);
        expect(result.stats.tokensTruncated).toBe(true);
      });

      it('should not truncate small data', () => {
        const data = { name: 'Short' };

        const config: OutputConfig = {
          maxTokens: 1000,
        };

        const result = applyOutputShaping(data, config);

        expect(result.data.name).toBe('Short');
        expect(result.stats.tokensTruncated).toBe(false);
      });
    });

    describe('combined config', () => {
      it('should apply all transformations in order', () => {
        const data = {
          id: '123',
          name: 'Customer',
          email: 'test@test.com',
          password: 'secret',
          notes: 'Some notes',
          items: [1, 2, 3, 4, 5],
        };

        const config: OutputConfig = {
          includeFields: ['id', 'name', 'password', 'items'],
          redactFields: ['password'],
          maxItems: 3,
        };

        const result = applyOutputShaping(data, config);

        expect(result.data.id).toBe('123');
        expect(result.data.name).toBe('Customer');
        expect(result.data.password).toBe('[REDACTED]');
        expect(result.data.email).toBeUndefined();
        expect(result.data.items).toEqual([1, 2, 3]);
        expect(result.stats.fieldsIncluded).toBe(4);
        expect(result.stats.fieldsRedacted).toBe(1);
        expect(result.stats.itemsLimited).toBe(2);
      });
    });

    describe('edge cases', () => {
      it('should handle null data', () => {
        const result = applyOutputShaping(null);

        expect(result.data).toBeNull();
      });

      it('should handle undefined data', () => {
        const result = applyOutputShaping(undefined);

        expect(result.data).toBeUndefined();
      });

      it('should handle primitive data', () => {
        const result = applyOutputShaping('string value');

        expect(result.data).toBe('string value');
      });

      it('should handle empty objects', () => {
        const result = applyOutputShaping({});

        expect(result.data).toEqual({});
      });

      it('should handle empty arrays', () => {
        const result = applyOutputShaping([]);

        expect(result.data).toEqual([]);
      });
    });
  });

  describe('hasOutputConfig', () => {
    it('should return false for undefined config', () => {
      expect(hasOutputConfig(undefined)).toBe(false);
    });

    it('should return false for empty config', () => {
      expect(hasOutputConfig({})).toBe(false);
    });

    it('should return true for config with includeFields', () => {
      expect(hasOutputConfig({ includeFields: ['id'] })).toBe(true);
    });

    it('should return true for config with redactFields', () => {
      expect(hasOutputConfig({ redactFields: ['password'] })).toBe(true);
    });

    it('should return true for config with maxItems', () => {
      expect(hasOutputConfig({ maxItems: 10 })).toBe(true);
    });

    it('should return true for config with maxTokens', () => {
      expect(hasOutputConfig({ maxTokens: 1000 })).toBe(true);
    });

    it('should return false for config with empty arrays', () => {
      expect(hasOutputConfig({ includeFields: [], redactFields: [] })).toBe(false);
    });
  });

  describe('mergeOutputConfigs', () => {
    it('should return empty config for no inputs', () => {
      const result = mergeOutputConfigs();

      expect(result).toEqual({});
    });

    it('should merge includeFields using intersection', () => {
      const config1: OutputConfig = { includeFields: ['id', 'name', 'email'] };
      const config2: OutputConfig = { includeFields: ['id', 'name', 'phone'] };

      const result = mergeOutputConfigs(config1, config2);

      expect(result.includeFields).toEqual(['id', 'name']);
    });

    it('should merge redactFields using union', () => {
      const config1: OutputConfig = { redactFields: ['password', 'ssn'] };
      const config2: OutputConfig = { redactFields: ['ssn', 'taxId'] };

      const result = mergeOutputConfigs(config1, config2);

      expect(result.redactFields).toEqual(['password', 'ssn', 'taxId']);
    });

    it('should use minimum maxItems', () => {
      const config1: OutputConfig = { maxItems: 100 };
      const config2: OutputConfig = { maxItems: 50 };

      const result = mergeOutputConfigs(config1, config2);

      expect(result.maxItems).toBe(50);
    });

    it('should use minimum maxTokens', () => {
      const config1: OutputConfig = { maxTokens: 5000 };
      const config2: OutputConfig = { maxTokens: 2000 };

      const result = mergeOutputConfigs(config1, config2);

      expect(result.maxTokens).toBe(2000);
    });

    it('should handle undefined configs', () => {
      const config1: OutputConfig = { maxItems: 10 };

      const result = mergeOutputConfigs(undefined, config1, undefined);

      expect(result.maxItems).toBe(10);
    });

    it('should merge all properties correctly', () => {
      const config1: OutputConfig = {
        includeFields: ['id', 'name', 'email'],
        redactFields: ['password'],
        maxItems: 100,
        maxTokens: 5000,
      };
      const config2: OutputConfig = {
        includeFields: ['id', 'name'],
        redactFields: ['ssn'],
        maxItems: 50,
        maxTokens: 2000,
      };

      const result = mergeOutputConfigs(config1, config2);

      expect(result).toEqual({
        includeFields: ['id', 'name'],
        redactFields: ['password', 'ssn'],
        maxItems: 50,
        maxTokens: 2000,
      });
    });
  });
});

describe('PII Redaction Security', () => {
  /**
   * CRITICAL: These tests ensure PII is NEVER leaked in tool responses.
   * If any of these tests fail, it represents a potential data breach.
   */

  const sensitiveFieldNames = [
    'password',
    'secret',
    'token',
    'apiKey',
    'api_key',
    'ssn',
    'socialSecurity',
    'social_security',
    'creditCard',
    'credit_card',
    'cardNumber',
    'card_number',
    'cvv',
    'cvc',
    'pin',
    'privateKey',
    'private_key',
  ];

  it('should redact all known PII field patterns by default', () => {
    const data: Record<string, string> = {};
    sensitiveFieldNames.forEach((field) => {
      data[field] = 'sensitive_value_' + field;
    });

    const result = applyOutputShaping(data);

    sensitiveFieldNames.forEach((field) => {
      expect(result.data[field]).toBe('[REDACTED]');
    });
  });

  it('should redact PII in deeply nested structures', () => {
    const data = {
      level1: {
        level2: {
          level3: {
            password: 'deep_secret',
            apiKey: 'deep_key',
          },
        },
      },
    };

    const result = applyOutputShaping(data);

    expect(result.data.level1.level2.level3.password).toBe('[REDACTED]');
    expect(result.data.level1.level2.level3.apiKey).toBe('[REDACTED]');
  });

  it('should redact PII in arrays of objects', () => {
    const data = [
      { name: 'User 1', password: 'pass1' },
      { name: 'User 2', password: 'pass2' },
      { name: 'User 3', password: 'pass3' },
    ];

    const result = applyOutputShaping(data);

    result.data.forEach((item: { password: string }) => {
      expect(item.password).toBe('[REDACTED]');
    });
  });

  it('should not leak PII even when includeFields requests it', () => {
    const data = {
      id: '123',
      password: 'secret',
      apiKey: 'key123',
    };

    // Even if includeFields requests password, it should still be redacted
    const config: OutputConfig = {
      includeFields: ['id', 'password', 'apiKey'],
    };

    const result = applyOutputShaping(data, config);

    // Fields are included but still redacted by default PII patterns
    expect(result.data.id).toBe('123');
    expect(result.data.password).toBe('[REDACTED]');
    expect(result.data.apiKey).toBe('[REDACTED]');
  });
});
