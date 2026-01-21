/**
 * GLAPI Conversational Ledger - Intent Catalog Tests
 */

import { describe, it, expect } from 'vitest';
import {
  INTENT_CATALOG,
  getIntentById,
  getIntentByMcpTool,
  getIntentsByCategory,
  getHighRiskIntents,
  getEnabledIntents,
  isIntentEnabled,
  type Intent,
  type IntentCategory,
} from '../intents';

describe('Intent Catalog', () => {
  describe('INTENT_CATALOG structure', () => {
    it('should have at least 20 intents defined', () => {
      const intentCount = Object.keys(INTENT_CATALOG).length;
      expect(intentCount).toBeGreaterThanOrEqual(20);
    });

    it('should have valid structure for all intents', () => {
      for (const [id, intent] of Object.entries(INTENT_CATALOG)) {
        expect(intent.id).toBe(id);
        expect(intent.name).toBeTruthy();
        expect(intent.description).toBeTruthy();
        expect(intent.category).toBeTruthy();
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(intent.riskLevel);
        expect(Array.isArray(intent.requiredPermissions)).toBe(true);
        expect(typeof intent.requiresConfirmation).toBe('boolean');
        expect(Array.isArray(intent.exampleUtterances)).toBe(true);
        expect(intent.exampleUtterances.length).toBeGreaterThan(0);
        expect(intent.mcpTool).toBeTruthy();
        expect(typeof intent.enabled).toBe('boolean');
      }
    });

    it('should have unique MCP tool names', () => {
      const toolNames = Object.values(INTENT_CATALOG).map((i) => i.mcpTool);
      const uniqueToolNames = new Set(toolNames);
      expect(uniqueToolNames.size).toBe(toolNames.length);
    });
  });

  describe('getIntentById', () => {
    it('should return intent for valid ID', () => {
      const intent = getIntentById('LIST_CUSTOMERS');
      expect(intent).toBeDefined();
      expect(intent?.id).toBe('LIST_CUSTOMERS');
      expect(intent?.name).toBe('List Customers');
    });

    it('should return undefined for invalid ID', () => {
      const intent = getIntentById('INVALID_INTENT_ID');
      expect(intent).toBeUndefined();
    });
  });

  describe('getIntentByMcpTool', () => {
    it('should return intent for valid tool name', () => {
      const intent = getIntentByMcpTool('list_customers');
      expect(intent).toBeDefined();
      expect(intent?.id).toBe('LIST_CUSTOMERS');
    });

    it('should return undefined for invalid tool name', () => {
      const intent = getIntentByMcpTool('invalid_tool');
      expect(intent).toBeUndefined();
    });

    it('should map create_journal_entry to CRITICAL risk', () => {
      const intent = getIntentByMcpTool('create_journal_entry');
      expect(intent).toBeDefined();
      expect(intent?.riskLevel).toBe('CRITICAL');
    });
  });

  describe('getIntentsByCategory', () => {
    it('should return all customer management intents', () => {
      const intents = getIntentsByCategory('CUSTOMER_MANAGEMENT');
      expect(intents.length).toBeGreaterThanOrEqual(3);
      expect(intents.every((i) => i.category === 'CUSTOMER_MANAGEMENT')).toBe(true);
    });

    it('should return journal entry intents', () => {
      const intents = getIntentsByCategory('JOURNAL_ENTRY');
      expect(intents.length).toBeGreaterThanOrEqual(2);
      expect(intents.every((i) => i.category === 'JOURNAL_ENTRY')).toBe(true);
    });

    it('should return empty array for invalid category', () => {
      const intents = getIntentsByCategory('INVALID_CATEGORY' as IntentCategory);
      expect(intents).toEqual([]);
    });
  });

  describe('getHighRiskIntents', () => {
    it('should return HIGH and CRITICAL risk intents', () => {
      const highRiskIntents = getHighRiskIntents();
      expect(highRiskIntents.length).toBeGreaterThan(0);
      expect(
        highRiskIntents.every(
          (i) => i.riskLevel === 'HIGH' || i.riskLevel === 'CRITICAL'
        )
      ).toBe(true);
    });

    it('should include journal entry intents', () => {
      const highRiskIntents = getHighRiskIntents();
      const journalEntryIntents = highRiskIntents.filter(
        (i) => i.category === 'JOURNAL_ENTRY'
      );
      expect(journalEntryIntents.length).toBeGreaterThanOrEqual(2);
    });

    it('should include CREATE_INVOICE', () => {
      const highRiskIntents = getHighRiskIntents();
      const createInvoice = highRiskIntents.find((i) => i.id === 'CREATE_INVOICE');
      expect(createInvoice).toBeDefined();
      expect(createInvoice?.riskLevel).toBe('HIGH');
    });
  });

  describe('getEnabledIntents', () => {
    it('should return only enabled intents', () => {
      const enabledIntents = getEnabledIntents();
      expect(enabledIntents.every((i) => i.enabled === true)).toBe(true);
    });

    it('should return a substantial number of intents', () => {
      const enabledIntents = getEnabledIntents();
      expect(enabledIntents.length).toBeGreaterThanOrEqual(15);
    });
  });

  describe('isIntentEnabled', () => {
    it('should return true for enabled intents', () => {
      expect(isIntentEnabled('LIST_CUSTOMERS')).toBe(true);
      expect(isIntentEnabled('CREATE_CUSTOMER')).toBe(true);
    });

    it('should return false for invalid intent IDs', () => {
      expect(isIntentEnabled('INVALID_INTENT')).toBe(false);
    });
  });

  describe('Risk level and confirmation requirements', () => {
    it('should require confirmation for MEDIUM risk intents that create data', () => {
      const createCustomer = getIntentById('CREATE_CUSTOMER');
      expect(createCustomer?.riskLevel).toBe('MEDIUM');
      expect(createCustomer?.requiresConfirmation).toBe(true);
    });

    it('should require confirmation for all CRITICAL intents', () => {
      const criticalIntents = Object.values(INTENT_CATALOG).filter(
        (i) => i.riskLevel === 'CRITICAL'
      );
      expect(criticalIntents.length).toBeGreaterThan(0);
      expect(criticalIntents.every((i) => i.requiresConfirmation)).toBe(true);
    });

    it('should not require confirmation for LOW risk intents', () => {
      const listCustomers = getIntentById('LIST_CUSTOMERS');
      expect(listCustomers?.riskLevel).toBe('LOW');
      expect(listCustomers?.requiresConfirmation).toBe(false);
    });
  });

  describe('Rate limits', () => {
    it('should have lower rate limits for higher risk intents', () => {
      const listCustomers = getIntentById('LIST_CUSTOMERS');
      const createJournalEntry = getIntentById('CREATE_JOURNAL_ENTRY');

      expect(listCustomers?.rateLimitPerMinute).toBeDefined();
      expect(createJournalEntry?.rateLimitPerMinute).toBeDefined();
      expect(listCustomers!.rateLimitPerMinute!).toBeGreaterThan(
        createJournalEntry!.rateLimitPerMinute!
      );
    });

    it('should have rate limits defined for all enabled intents', () => {
      const enabledIntents = getEnabledIntents();
      for (const intent of enabledIntents) {
        expect(intent.rateLimitPerMinute).toBeDefined();
        expect(intent.rateLimitPerMinute).toBeGreaterThan(0);
      }
    });
  });
});
