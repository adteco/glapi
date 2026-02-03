/**
 * Tests for OpenAPI Generator AI Extensions
 *
 * Verifies the generator correctly emits x-ai-* extensions
 * for AI-enabled tRPC procedures.
 *
 * @see packages/trpc/src/openapi-generator.ts
 */

import { describe, it, expect } from 'vitest';
import {
  emitAIExtensions,
  generateOpenAPISpec,
  generateOpenAPIJSON,
  zodToOpenAPI,
} from '../openapi-generator';
import type { AIProcedureMeta } from '../ai-meta';
import { z } from 'zod';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Minimal AI metadata with only required fields
 */
const minimalAIMeta: AIProcedureMeta = {
  tool: {
    name: 'test_tool',
    description: 'A test tool',
  },
  risk: {
    level: 'LOW',
  },
  permissions: {
    required: ['read:test'],
    minimumRole: 'viewer',
  },
};

/**
 * Full AI metadata with all optional fields populated
 */
const fullAIMeta: AIProcedureMeta = {
  tool: {
    name: 'full_test_tool',
    version: 2,
    stability: 'beta',
    deprecated: true,
    replacement: 'new_test_tool',
    description: 'A fully configured test tool',
    scopes: ['sales', 'finance'],
    enabled: true,
    exampleUtterances: ['test this tool', 'use the test tool'],
  },
  risk: {
    level: 'HIGH',
    requiresConfirmation: true,
    supportsDryRun: true,
    confirmationMessage: 'Are you sure you want to proceed?',
  },
  permissions: {
    required: ['write:test', 'delete:test'],
    minimumRole: 'manager',
  },
  policy: {
    allowTiers: ['enterprise', 'pro'],
    requireMfaForRisk: ['HIGH', 'CRITICAL'],
    rowScope: 'organization.id == user.orgId',
    maxAffectedRecords: 100,
  },
  rateLimit: {
    requestsPerMinute: 30,
    burstLimit: 5,
    scope: 'organization',
  },
  output: {
    includeFields: ['id', 'name', 'status'],
    redactFields: ['ssn', 'creditCard'],
    maxItems: 50,
    maxTokens: 1000,
  },
  idempotency: {
    keySource: 'header',
    ttlSeconds: 3600,
  },
  timeouts: {
    softMs: 5000,
    hardMs: 15000,
    retryable: false,
  },
  cache: {
    enabled: true,
    ttlSeconds: 120,
    varyBy: ['id', 'status'],
    invalidateOn: ['test.updated', 'test.deleted'],
  },
  errors: [
    {
      code: 'TEST_NOT_FOUND',
      retryable: false,
      userSafeMessage: 'The requested test resource was not found.',
    },
    {
      code: 'TEST_CONFLICT',
      retryable: true,
      userSafeMessage: 'A conflict occurred. Please try again.',
    },
  ],
  async: {
    enabled: true,
    statusEndpoint: '/api/test/{id}/status',
    terminalStates: ['completed', 'failed', 'cancelled'],
    polling: {
      minMs: 1000,
      maxMs: 10000,
    },
  },
  financialLimits: {
    staff: 1000,
    manager: 10000,
    accountant: 50000,
    admin: 100000,
  },
};

// =============================================================================
// emitAIExtensions Tests
// =============================================================================

describe('emitAIExtensions', () => {
  describe('with minimal metadata', () => {
    it('should emit required x-ai-tool extension', () => {
      const result = emitAIExtensions(minimalAIMeta);

      expect(result['x-ai-tool']).toBeDefined();
      expect(result['x-ai-tool'].name).toBe('test_tool');
      expect(result['x-ai-tool'].description).toBe('A test tool');
      expect(result['x-ai-tool'].version).toBe(1); // default
      expect(result['x-ai-tool'].stability).toBe('stable'); // default
      expect(result['x-ai-tool'].deprecated).toBe(false); // default
      expect(result['x-ai-tool'].enabled).toBe(true); // default
    });

    it('should emit required x-ai-risk extension', () => {
      const result = emitAIExtensions(minimalAIMeta);

      expect(result['x-ai-risk']).toBeDefined();
      expect(result['x-ai-risk'].level).toBe('LOW');
      expect(result['x-ai-risk'].requiresConfirmation).toBe(false); // default
      expect(result['x-ai-risk'].supportsDryRun).toBe(false); // default
    });

    it('should emit required x-ai-permissions extension', () => {
      const result = emitAIExtensions(minimalAIMeta);

      expect(result['x-ai-permissions']).toBeDefined();
      expect(result['x-ai-permissions'].required).toEqual(['read:test']);
      expect(result['x-ai-permissions'].minimumRole).toBe('viewer');
    });

    it('should NOT emit optional extensions when not provided', () => {
      const result = emitAIExtensions(minimalAIMeta);

      expect(result['x-ai-policy']).toBeUndefined();
      expect(result['x-ai-rate-limit']).toBeUndefined();
      expect(result['x-ai-output']).toBeUndefined();
      expect(result['x-ai-idempotency']).toBeUndefined();
      expect(result['x-ai-timeouts']).toBeUndefined();
      expect(result['x-ai-cache']).toBeUndefined();
      expect(result['x-ai-errors']).toBeUndefined();
      expect(result['x-ai-async']).toBeUndefined();
      expect(result['x-ai-financial-limits']).toBeUndefined();
    });
  });

  describe('with full metadata', () => {
    it('should emit x-ai-tool with all fields', () => {
      const result = emitAIExtensions(fullAIMeta);

      expect(result['x-ai-tool']).toEqual({
        name: 'full_test_tool',
        version: 2,
        stability: 'beta',
        deprecated: true,
        replacement: 'new_test_tool',
        description: 'A fully configured test tool',
        scopes: ['sales', 'finance'],
        enabled: true,
        exampleUtterances: ['test this tool', 'use the test tool'],
      });
    });

    it('should emit x-ai-risk with all fields', () => {
      const result = emitAIExtensions(fullAIMeta);

      expect(result['x-ai-risk']).toEqual({
        level: 'HIGH',
        requiresConfirmation: true,
        supportsDryRun: true,
        confirmationMessage: 'Are you sure you want to proceed?',
      });
    });

    it('should emit x-ai-policy extension', () => {
      const result = emitAIExtensions(fullAIMeta);

      expect(result['x-ai-policy']).toEqual({
        allowTiers: ['enterprise', 'pro'],
        requireMfaForRisk: ['HIGH', 'CRITICAL'],
        rowScope: 'organization.id == user.orgId',
        maxAffectedRecords: 100,
      });
    });

    it('should emit x-ai-rate-limit extension', () => {
      const result = emitAIExtensions(fullAIMeta);

      expect(result['x-ai-rate-limit']).toEqual({
        requestsPerMinute: 30,
        burstLimit: 5,
        scope: 'organization',
      });
    });

    it('should emit x-ai-output extension', () => {
      const result = emitAIExtensions(fullAIMeta);

      expect(result['x-ai-output']).toEqual({
        includeFields: ['id', 'name', 'status'],
        redactFields: ['ssn', 'creditCard'],
        maxItems: 50,
        maxTokens: 1000,
      });
    });

    it('should emit x-ai-idempotency extension', () => {
      const result = emitAIExtensions(fullAIMeta);

      expect(result['x-ai-idempotency']).toEqual({
        keySource: 'header',
        ttlSeconds: 3600,
      });
    });

    it('should emit x-ai-timeouts extension', () => {
      const result = emitAIExtensions(fullAIMeta);

      expect(result['x-ai-timeouts']).toEqual({
        softMs: 5000,
        hardMs: 15000,
        retryable: false,
      });
    });

    it('should emit x-ai-cache extension', () => {
      const result = emitAIExtensions(fullAIMeta);

      expect(result['x-ai-cache']).toEqual({
        enabled: true,
        ttlSeconds: 120,
        varyBy: ['id', 'status'],
        invalidateOn: ['test.updated', 'test.deleted'],
      });
    });

    it('should emit x-ai-errors extension', () => {
      const result = emitAIExtensions(fullAIMeta);

      expect(result['x-ai-errors']).toEqual([
        {
          code: 'TEST_NOT_FOUND',
          retryable: false,
          userSafeMessage: 'The requested test resource was not found.',
        },
        {
          code: 'TEST_CONFLICT',
          retryable: true,
          userSafeMessage: 'A conflict occurred. Please try again.',
        },
      ]);
    });

    it('should emit x-ai-async extension', () => {
      const result = emitAIExtensions(fullAIMeta);

      expect(result['x-ai-async']).toEqual({
        enabled: true,
        statusEndpoint: '/api/test/{id}/status',
        terminalStates: ['completed', 'failed', 'cancelled'],
        polling: {
          minMs: 1000,
          maxMs: 10000,
        },
      });
    });

    it('should emit x-ai-financial-limits extension', () => {
      const result = emitAIExtensions(fullAIMeta);

      expect(result['x-ai-financial-limits']).toEqual({
        staff: 1000,
        manager: 10000,
        accountant: 50000,
        admin: 100000,
      });
    });
  });

  describe('snapshot tests', () => {
    it('should match snapshot for minimal metadata', () => {
      const result = emitAIExtensions(minimalAIMeta);
      expect(result).toMatchSnapshot();
    });

    it('should match snapshot for full metadata', () => {
      const result = emitAIExtensions(fullAIMeta);
      expect(result).toMatchSnapshot();
    });
  });
});

// =============================================================================
// generateOpenAPISpec Tests
// =============================================================================

describe('generateOpenAPISpec', () => {
  it('should generate valid OpenAPI 3.0.3 spec', () => {
    const spec = generateOpenAPISpec();

    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info).toBeDefined();
    expect(spec.info.title).toContain('GLAPI');
    expect(spec.paths).toBeDefined();
    expect(spec.components).toBeDefined();
  });

  it('should include security schemes', () => {
    const spec = generateOpenAPISpec();

    expect(spec.components.securitySchemes).toBeDefined();
    expect(spec.components.securitySchemes.ClerkAuth).toBeDefined();
    expect(spec.components.securitySchemes.ClerkAuth.type).toBe('http');
    expect(spec.components.securitySchemes.ClerkAuth.scheme).toBe('bearer');
  });

  it('should generate paths for all routers', () => {
    const spec = generateOpenAPISpec();

    // Check that paths exist for key resources
    expect(spec.paths['/api/customers']).toBeDefined();
    expect(spec.paths['/api/vendors']).toBeDefined();
    expect(spec.paths['/api/invoices']).toBeDefined();
    expect(spec.paths['/api/accounts']).toBeDefined();
  });

  describe('with AI extensions enabled (default)', () => {
    it('should include x-ai-tool on list operations', () => {
      const spec = generateOpenAPISpec();
      const listCustomers = spec.paths['/api/customers']?.get;

      expect(listCustomers).toBeDefined();
      expect(listCustomers['x-ai-tool']).toBeDefined();
      expect(listCustomers['x-ai-tool'].name).toBe('list_customers');
    });

    it('should include x-ai-risk on operations', () => {
      const spec = generateOpenAPISpec();
      const listCustomers = spec.paths['/api/customers']?.get;
      const deleteCustomer = spec.paths['/api/customers/{id}']?.delete;

      expect(listCustomers['x-ai-risk'].level).toBe('LOW');
      expect(deleteCustomer['x-ai-risk'].level).toBe('HIGH');
    });

    it('should include x-ai-permissions on operations', () => {
      const spec = generateOpenAPISpec();
      const listCustomers = spec.paths['/api/customers']?.get;

      expect(listCustomers['x-ai-permissions']).toBeDefined();
      expect(listCustomers['x-ai-permissions'].required).toContain('read:customers');
      expect(listCustomers['x-ai-permissions'].minimumRole).toBe('viewer');
    });

    it('should set appropriate risk levels by operation type', () => {
      const spec = generateOpenAPISpec();

      // List/Get = LOW
      expect(spec.paths['/api/customers']?.get['x-ai-risk'].level).toBe('LOW');
      expect(spec.paths['/api/customers/{id}']?.get['x-ai-risk'].level).toBe('LOW');

      // Create/Update = MEDIUM
      expect(spec.paths['/api/customers']?.post['x-ai-risk'].level).toBe('MEDIUM');
      expect(spec.paths['/api/customers/{id}']?.put['x-ai-risk'].level).toBe('MEDIUM');

      // Delete = HIGH
      expect(spec.paths['/api/customers/{id}']?.delete['x-ai-risk'].level).toBe('HIGH');
    });

    it('should set appropriate minimum roles by operation type', () => {
      const spec = generateOpenAPISpec();

      // Read = viewer
      expect(spec.paths['/api/customers']?.get['x-ai-permissions'].minimumRole).toBe('viewer');

      // Write = staff
      expect(spec.paths['/api/customers']?.post['x-ai-permissions'].minimumRole).toBe('staff');

      // Delete = manager
      expect(spec.paths['/api/customers/{id}']?.delete['x-ai-permissions'].minimumRole).toBe('manager');
    });
  });

  describe('with AI extensions disabled', () => {
    it('should NOT include x-ai-* extensions', () => {
      const spec = generateOpenAPISpec({ includeAIExtensions: false });
      const listCustomers = spec.paths['/api/customers']?.get;

      expect(listCustomers['x-ai-tool']).toBeUndefined();
      expect(listCustomers['x-ai-risk']).toBeUndefined();
      expect(listCustomers['x-ai-permissions']).toBeUndefined();
    });
  });

  describe('with default AI meta disabled', () => {
    it('should NOT include AI extensions without explicit meta', () => {
      const spec = generateOpenAPISpec({
        includeAIExtensions: true,
        useDefaultAIMeta: false,
      });
      const listCustomers = spec.paths['/api/customers']?.get;

      expect(listCustomers['x-ai-tool']).toBeUndefined();
    });
  });

  describe('with AI meta overrides', () => {
    it('should use override instead of default', () => {
      const customMeta: AIProcedureMeta = {
        tool: {
          name: 'custom_list_customers',
          description: 'Custom customer listing',
          scopes: ['custom'],
        },
        risk: {
          level: 'MEDIUM',
          requiresConfirmation: true,
        },
        permissions: {
          required: ['custom:permission'],
          minimumRole: 'admin',
        },
      };

      const spec = generateOpenAPISpec({
        aiMetaOverrides: {
          'customers.list': customMeta,
        },
      });

      const listCustomers = spec.paths['/api/customers']?.get;

      expect(listCustomers['x-ai-tool'].name).toBe('custom_list_customers');
      expect(listCustomers['x-ai-tool'].scopes).toEqual(['custom']);
      expect(listCustomers['x-ai-risk'].level).toBe('MEDIUM');
      expect(listCustomers['x-ai-permissions'].minimumRole).toBe('admin');
    });
  });

  describe('snapshot tests', () => {
    it('should match snapshot for spec with AI extensions', () => {
      const spec = generateOpenAPISpec();
      // Only snapshot a subset to keep test manageable
      const subset = {
        openapi: spec.openapi,
        info: spec.info,
        customers: spec.paths['/api/customers'],
        customersById: spec.paths['/api/customers/{id}'],
      };
      expect(subset).toMatchSnapshot();
    });

    it('should match snapshot for spec without AI extensions', () => {
      const spec = generateOpenAPISpec({ includeAIExtensions: false });
      const subset = {
        openapi: spec.openapi,
        customers: spec.paths['/api/customers'],
      };
      expect(subset).toMatchSnapshot();
    });
  });
});

// =============================================================================
// zodToOpenAPI Tests
// =============================================================================

describe('zodToOpenAPI', () => {
  it('should convert ZodString to OpenAPI string', () => {
    const schema = z.string();
    const result = zodToOpenAPI(schema);

    expect(result).toEqual({ type: 'string' });
  });

  it('should convert ZodString with email format', () => {
    const schema = z.string().email();
    const result = zodToOpenAPI(schema);

    expect(result).toEqual({ type: 'string', format: 'email' });
  });

  it('should convert ZodString with uuid format', () => {
    const schema = z.string().uuid();
    const result = zodToOpenAPI(schema);

    expect(result).toEqual({ type: 'string', format: 'uuid' });
  });

  it('should convert ZodNumber to OpenAPI number', () => {
    const schema = z.number();
    const result = zodToOpenAPI(schema);

    expect(result).toEqual({ type: 'number' });
  });

  it('should convert ZodBoolean to OpenAPI boolean', () => {
    const schema = z.boolean();
    const result = zodToOpenAPI(schema);

    expect(result).toEqual({ type: 'boolean' });
  });

  it('should convert ZodDate to OpenAPI date-time', () => {
    const schema = z.date();
    const result = zodToOpenAPI(schema);

    expect(result).toEqual({ type: 'string', format: 'date-time' });
  });

  it('should convert ZodEnum to OpenAPI enum', () => {
    const schema = z.enum(['active', 'inactive', 'pending']);
    const result = zodToOpenAPI(schema);

    expect(result).toEqual({
      type: 'string',
      enum: ['active', 'inactive', 'pending'],
    });
  });

  it('should convert ZodArray to OpenAPI array', () => {
    const schema = z.array(z.string());
    const result = zodToOpenAPI(schema);

    expect(result).toEqual({
      type: 'array',
      items: { type: 'string' },
    });
  });

  it('should convert ZodObject to OpenAPI object', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const result = zodToOpenAPI(schema);

    expect(result).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
    });
  });

  it('should handle optional fields correctly', () => {
    const schema = z.object({
      name: z.string(),
      nickname: z.string().optional(),
    });
    const result = zodToOpenAPI(schema);

    expect(result.required).toEqual(['name']);
    expect(result.properties.nickname).toBeDefined();
  });

  it('should convert ZodOptional', () => {
    const schema = z.string().optional();
    const result = zodToOpenAPI(schema);

    expect(result).toEqual({ type: 'string' });
  });

  it('should convert ZodNullable with nullable flag', () => {
    const schema = z.string().nullable();
    const result = zodToOpenAPI(schema);

    expect(result).toEqual({ type: 'string', nullable: true });
  });

  it('should convert ZodDefault with default value', () => {
    const schema = z.string().default('hello');
    const result = zodToOpenAPI(schema);

    expect(result).toEqual({ type: 'string', default: 'hello' });
  });

  it('should return object type for undefined schema', () => {
    const result = zodToOpenAPI(undefined);

    expect(result).toEqual({ type: 'object' });
  });
});

// =============================================================================
// generateOpenAPIJSON Tests
// =============================================================================

describe('generateOpenAPIJSON', () => {
  it('should return valid JSON string', () => {
    const json = generateOpenAPIJSON();

    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('should be properly formatted with 2-space indentation', () => {
    const json = generateOpenAPIJSON();
    const lines = json.split('\n');

    // Check that nested content is indented
    const indentedLine = lines.find((l) => l.startsWith('  "'));
    expect(indentedLine).toBeDefined();
  });
});
