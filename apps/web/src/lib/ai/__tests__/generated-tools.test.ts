/**
 * GLAPI Conversational Ledger - Generated AI Tools Tests
 *
 * Tests for the auto-generated AI tool definitions from OpenAPI specs.
 * Validates tool structure, metadata, and helper functions.
 */

import { describe, it, expect } from 'vitest';
import {
  AI_TOOLS,
  AI_TOOLS_BY_NAME,
  getToolByName,
  getToolsByScope,
  getOpenAITools,
  TOOL_COUNT,
  type GeneratedAITool,
  type AIToolMetadata,
  type RiskLevel,
  type UserRole,
} from '../generated';
import toolsManifest from '../generated/tools-manifest.json';

describe('Generated AI Tools', () => {
  describe('AI_TOOLS array', () => {
    it('should have the expected number of tools', () => {
      expect(AI_TOOLS.length).toBe(TOOL_COUNT);
      expect(AI_TOOLS.length).toBe(105);
    });

    it('should match manifest tool count', () => {
      expect(AI_TOOLS.length).toBe(toolsManifest.toolCount);
    });

    it('should have valid structure for all tools', () => {
      for (const tool of AI_TOOLS) {
        // Function declaration structure
        expect(tool.functionDeclaration).toBeDefined();
        expect(tool.functionDeclaration.type).toBe('function');
        expect(tool.functionDeclaration.function).toBeDefined();
        expect(tool.functionDeclaration.function.name).toBeTruthy();
        expect(tool.functionDeclaration.function.description).toBeTruthy();
        expect(tool.functionDeclaration.function.parameters).toBeDefined();

        // Metadata structure
        expect(tool.metadata).toBeDefined();
        expect(tool.metadata.name).toBe(tool.functionDeclaration.function.name);
        expect(tool.metadata.version).toBeGreaterThanOrEqual(1);
        expect(['stable', 'beta', 'experimental']).toContain(tool.metadata.stability);
        expect(typeof tool.metadata.deprecated).toBe('boolean');
        expect(tool.metadata.description).toBeTruthy();
        expect(Array.isArray(tool.metadata.scopes)).toBe(true);
        expect(tool.metadata.scopes.length).toBeGreaterThan(0);
        expect(typeof tool.metadata.enabled).toBe('boolean');
      }
    });

    it('should have valid risk metadata for all tools', () => {
      const validRiskLevels: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

      for (const tool of AI_TOOLS) {
        expect(tool.metadata.risk).toBeDefined();
        expect(validRiskLevels).toContain(tool.metadata.risk.level);
        expect(typeof tool.metadata.risk.requiresConfirmation).toBe('boolean');
        expect(typeof tool.metadata.risk.supportsDryRun).toBe('boolean');
      }
    });

    it('should have valid permission metadata for all tools', () => {
      const validRoles: UserRole[] = ['viewer', 'staff', 'manager', 'accountant', 'admin'];

      for (const tool of AI_TOOLS) {
        expect(tool.metadata.permissions).toBeDefined();
        expect(Array.isArray(tool.metadata.permissions.required)).toBe(true);
        expect(validRoles).toContain(tool.metadata.permissions.minimumRole);
      }
    });

    it('should have unique tool names', () => {
      const names = AI_TOOLS.map((t) => t.metadata.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should have unique operation IDs', () => {
      const operationIds = AI_TOOLS.map((t) => t.metadata.operationId);
      const uniqueIds = new Set(operationIds);
      expect(uniqueIds.size).toBe(operationIds.length);
    });
  });

  describe('AI_TOOLS_BY_NAME map', () => {
    it('should contain all tools', () => {
      expect(AI_TOOLS_BY_NAME.size).toBe(TOOL_COUNT);
    });

    it('should map tool names correctly', () => {
      const listCustomers = AI_TOOLS_BY_NAME.get('list_customers');
      expect(listCustomers).toBeDefined();
      expect(listCustomers?.metadata.name).toBe('list_customers');

      const createCustomer = AI_TOOLS_BY_NAME.get('create_customer');
      expect(createCustomer).toBeDefined();
      expect(createCustomer?.metadata.name).toBe('create_customer');
    });
  });

  describe('getToolByName', () => {
    it('should return tool for valid name', () => {
      const tool = getToolByName('list_customers');
      expect(tool).toBeDefined();
      expect(tool?.metadata.name).toBe('list_customers');
      expect(tool?.metadata.risk.level).toBe('LOW');
    });

    it('should return undefined for invalid name', () => {
      const tool = getToolByName('invalid_tool_name');
      expect(tool).toBeUndefined();
    });

    it('should find all CRUD tools for customers', () => {
      expect(getToolByName('list_customers')).toBeDefined();
      expect(getToolByName('create_customer')).toBeDefined();
      expect(getToolByName('get_customer')).toBeDefined();
      expect(getToolByName('update_customer')).toBeDefined();
      expect(getToolByName('delete_customer')).toBeDefined();
    });
  });

  describe('getToolsByScope', () => {
    it('should return tools matching scope', () => {
      const globalTools = getToolsByScope(['global']);
      expect(globalTools.length).toBeGreaterThan(0);
      expect(globalTools.every((t) => t.metadata.scopes.includes('global'))).toBe(true);
    });

    it('should return empty array for unknown scope', () => {
      const tools = getToolsByScope(['unknown_scope']);
      expect(tools).toEqual([]);
    });

    it('should support multiple scopes', () => {
      const tools = getToolsByScope(['global', 'accounting']);
      // Should return tools from either scope
      for (const tool of tools) {
        const hasMatchingScope = tool.metadata.scopes.some((s) =>
          ['global', 'accounting'].includes(s)
        );
        expect(hasMatchingScope).toBe(true);
      }
    });
  });

  describe('getOpenAITools', () => {
    it('should return OpenAI-compatible tool definitions', () => {
      const openAITools = getOpenAITools(['global']);
      expect(openAITools.length).toBeGreaterThan(0);

      for (const tool of openAITools) {
        expect(tool.type).toBe('function');
        expect(tool.function).toBeDefined();
        expect(tool.function.name).toBeTruthy();
        expect(tool.function.description).toBeTruthy();
        expect(tool.function.parameters).toBeDefined();
      }
    });

    it('should not include metadata in OpenAI format', () => {
      const openAITools = getOpenAITools(['global']);
      for (const tool of openAITools) {
        // OpenAI tools should only have type and function
        expect(Object.keys(tool)).toEqual(['type', 'function']);
        expect((tool as any).metadata).toBeUndefined();
      }
    });
  });

  describe('Risk Level Mapping', () => {
    it('should have LOW risk for list operations', () => {
      const listTools = AI_TOOLS.filter((t) => t.metadata.name.startsWith('list_'));
      expect(listTools.length).toBeGreaterThan(0);
      expect(listTools.every((t) => t.metadata.risk.level === 'LOW')).toBe(true);
    });

    it('should have LOW risk for get operations', () => {
      const getTools = AI_TOOLS.filter((t) => t.metadata.name.startsWith('get_'));
      expect(getTools.length).toBeGreaterThan(0);
      expect(getTools.every((t) => t.metadata.risk.level === 'LOW')).toBe(true);
    });

    it('should have MEDIUM or higher risk for create operations', () => {
      const createTools = AI_TOOLS.filter((t) => t.metadata.name.startsWith('create_'));
      expect(createTools.length).toBeGreaterThan(0);
      expect(
        createTools.every((t) => ['MEDIUM', 'HIGH', 'CRITICAL'].includes(t.metadata.risk.level))
      ).toBe(true);
    });

    it('should have HIGH or higher risk for delete operations', () => {
      const deleteTools = AI_TOOLS.filter((t) => t.metadata.name.startsWith('delete_'));
      expect(deleteTools.length).toBeGreaterThan(0);
      expect(
        deleteTools.every((t) => ['HIGH', 'CRITICAL'].includes(t.metadata.risk.level))
      ).toBe(true);
    });
  });

  describe('Confirmation Requirements', () => {
    it('should not require confirmation for LOW risk tools', () => {
      const lowRiskTools = AI_TOOLS.filter((t) => t.metadata.risk.level === 'LOW');
      expect(lowRiskTools.length).toBeGreaterThan(0);
      expect(lowRiskTools.every((t) => !t.metadata.risk.requiresConfirmation)).toBe(true);
    });

    it('should require confirmation for create operations', () => {
      const createTools = AI_TOOLS.filter((t) => t.metadata.name.startsWith('create_'));
      expect(createTools.every((t) => t.metadata.risk.requiresConfirmation)).toBe(true);
    });

    it('should require confirmation for delete operations', () => {
      const deleteTools = AI_TOOLS.filter((t) => t.metadata.name.startsWith('delete_'));
      expect(deleteTools.every((t) => t.metadata.risk.requiresConfirmation)).toBe(true);
    });
  });

  describe('Permission Structure', () => {
    it('should have read permissions for list/get tools', () => {
      const readTools = AI_TOOLS.filter(
        (t) => t.metadata.name.startsWith('list_') || t.metadata.name.startsWith('get_')
      );
      for (const tool of readTools) {
        const hasReadPermission = tool.metadata.permissions.required.some((p) =>
          p.startsWith('read:')
        );
        expect(hasReadPermission).toBe(true);
      }
    });

    it('should have write permissions for create/update tools', () => {
      const writeTools = AI_TOOLS.filter(
        (t) => t.metadata.name.startsWith('create_') || t.metadata.name.startsWith('update_')
      );
      for (const tool of writeTools) {
        const hasWritePermission = tool.metadata.permissions.required.some((p) =>
          p.startsWith('write:')
        );
        expect(hasWritePermission).toBe(true);
      }
    });

    it('should have delete permissions for delete tools', () => {
      const deleteTools = AI_TOOLS.filter((t) => t.metadata.name.startsWith('delete_'));
      for (const tool of deleteTools) {
        const hasDeletePermission = tool.metadata.permissions.required.some((p) =>
          p.startsWith('delete:')
        );
        expect(hasDeletePermission).toBe(true);
      }
    });

    it('should allow viewers for read-only operations', () => {
      const readTools = AI_TOOLS.filter(
        (t) => t.metadata.name.startsWith('list_') || t.metadata.name.startsWith('get_')
      );
      expect(readTools.every((t) => t.metadata.permissions.minimumRole === 'viewer')).toBe(true);
    });

    it('should require staff or higher for write operations', () => {
      const writeTools = AI_TOOLS.filter(
        (t) => t.metadata.name.startsWith('create_') || t.metadata.name.startsWith('update_')
      );
      const allowedRoles: UserRole[] = ['staff', 'manager', 'accountant', 'admin'];
      expect(
        writeTools.every((t) => allowedRoles.includes(t.metadata.permissions.minimumRole))
      ).toBe(true);
    });
  });

  describe('Rate Limits', () => {
    it('should have rate limits for all tools', () => {
      for (const tool of AI_TOOLS) {
        expect(tool.metadata.rateLimit).toBeDefined();
        expect(tool.metadata.rateLimit!.requestsPerMinute).toBeGreaterThan(0);
        expect(['user', 'organization', 'global']).toContain(tool.metadata.rateLimit!.scope);
      }
    });

    it('should have higher rate limits for read operations', () => {
      const listCustomers = getToolByName('list_customers');
      const createCustomer = getToolByName('create_customer');

      expect(listCustomers?.metadata.rateLimit?.requestsPerMinute).toBeGreaterThan(
        createCustomer?.metadata.rateLimit?.requestsPerMinute || 0
      );
    });
  });

  describe('Cache Configuration', () => {
    it('should have cache enabled for read operations', () => {
      const readTools = AI_TOOLS.filter(
        (t) => t.metadata.name.startsWith('list_') || t.metadata.name.startsWith('get_')
      );
      for (const tool of readTools) {
        expect(tool.metadata.cache).toBeDefined();
        expect(tool.metadata.cache!.enabled).toBe(true);
        expect(tool.metadata.cache!.ttlSeconds).toBeGreaterThan(0);
      }
    });

    it('should not have cache for write operations', () => {
      const writeTools = AI_TOOLS.filter(
        (t) =>
          t.metadata.name.startsWith('create_') ||
          t.metadata.name.startsWith('update_') ||
          t.metadata.name.startsWith('delete_')
      );
      for (const tool of writeTools) {
        // Write operations either have no cache or cache.enabled = false
        if (tool.metadata.cache) {
          expect(tool.metadata.cache.enabled).toBe(false);
        }
      }
    });
  });

  describe('Tools Manifest', () => {
    it('should have valid manifest structure', () => {
      expect(toolsManifest.version).toBeDefined();
      expect(toolsManifest.generatedAt).toBeDefined();
      expect(toolsManifest.contentHash).toBeDefined();
      expect(toolsManifest.toolCount).toBe(TOOL_COUNT);
      expect(Array.isArray(toolsManifest.tools)).toBe(true);
    });

    it('should have manifest entries for all tools', () => {
      expect(toolsManifest.tools.length).toBe(TOOL_COUNT);
    });

    it('should match AI_TOOLS entries', () => {
      for (const manifestEntry of toolsManifest.tools) {
        const tool = getToolByName(manifestEntry.name);
        expect(tool).toBeDefined();
        expect(tool?.metadata.version).toBe(manifestEntry.version);
        expect(tool?.metadata.stability).toBe(manifestEntry.stability);
        expect(tool?.metadata.risk.level).toBe(manifestEntry.riskLevel);
      }
    });
  });

  describe('Entity Coverage', () => {
    // These are the actual entity names used in the generated tools (camelCase)
    const expectedListTools = [
      'list_customers',
      'list_organizations',
      'list_subsidiaries',
      'list_departments',
      'list_locations',
      'list_classes',
      'list_items',
      'list_priceLists',
      'list_warehouses',
      'list_vendors',
      'list_accounts',
      'list_leads',
      'list_employees',
      'list_prospects',
      'list_contacts',
      'list_unitsOfMeasure',
      'list_businessTransactions',
      'list_subscriptions',
      'list_invoices',
      'list_payments',
      'list_revenue',
    ];

    it('should have list tools for all expected entities', () => {
      for (const toolName of expectedListTools) {
        const tool = getToolByName(toolName);
        expect(tool).toBeDefined();
        expect(tool?.metadata.risk.level).toBe('LOW');
      }
    });

    it('should have 21 entity types with CRUD operations', () => {
      const listTools = AI_TOOLS.filter((t) => t.metadata.name.startsWith('list_'));
      expect(listTools.length).toBe(21);
    });
  });
});
