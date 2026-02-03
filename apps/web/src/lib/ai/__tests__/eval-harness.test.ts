/**
 * AI Evaluation Harness Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  // Golden Prompts
  ALL_GOLDEN_PROMPTS,
  TOOL_SELECTION_PROMPTS,
  getPromptsByCategory,
  getPromptsByTag,
  getPromptById,
  // Harness
  runEvalHarness,
  evaluatePrompt,
  scoreResult,
  didPass,
  calculateSummary,
  compareToBaseline,
  formatSummaryMarkdown,
  type GoldenPrompt,
  type MockResponse,
  type EvalResult,
  type EvalSummary,
} from '../eval';

describe('Golden Prompts', () => {
  describe('ALL_GOLDEN_PROMPTS', () => {
    it('should have unique IDs', () => {
      const ids = ALL_GOLDEN_PROMPTS.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have required fields', () => {
      for (const prompt of ALL_GOLDEN_PROMPTS) {
        expect(prompt.id).toBeTruthy();
        expect(prompt.category).toBeTruthy();
        expect(prompt.description).toBeTruthy();
        expect(prompt.prompt).toBeTruthy();
        expect(prompt.expectedBehavior).toBeDefined();
      }
    });

    it('should have valid categories', () => {
      const validCategories = [
        'tool_selection',
        'validation_recovery',
        'confirmation_compliance',
        'permission_handling',
        'error_handling',
        'multi_step',
        'ambiguity_handling',
      ];
      for (const prompt of ALL_GOLDEN_PROMPTS) {
        expect(validCategories).toContain(prompt.category);
      }
    });
  });

  describe('getPromptsByCategory', () => {
    it('should filter by category', () => {
      const toolSelectionPrompts = getPromptsByCategory('tool_selection');
      expect(toolSelectionPrompts.length).toBeGreaterThan(0);
      expect(toolSelectionPrompts.every((p) => p.category === 'tool_selection')).toBe(true);
    });

    it('should return empty for unknown category', () => {
      const prompts = getPromptsByCategory('unknown' as any);
      expect(prompts).toHaveLength(0);
    });
  });

  describe('getPromptsByTag', () => {
    it('should filter by tag', () => {
      const customerPrompts = getPromptsByTag('customers');
      expect(customerPrompts.length).toBeGreaterThan(0);
      expect(customerPrompts.every((p) => p.tags?.includes('customers'))).toBe(true);
    });
  });

  describe('getPromptById', () => {
    it('should find prompt by ID', () => {
      const prompt = getPromptById('ts-001');
      expect(prompt).toBeDefined();
      expect(prompt?.id).toBe('ts-001');
    });

    it('should return undefined for unknown ID', () => {
      const prompt = getPromptById('unknown-id');
      expect(prompt).toBeUndefined();
    });
  });
});

describe('Evaluation Logic', () => {
  const mockPrompt: GoldenPrompt = {
    id: 'test-001',
    category: 'tool_selection',
    description: 'Test prompt',
    prompt: 'List all customers',
    expectedBehavior: {
      expectedTool: 'list_customers',
      expectedRiskLevel: 'LOW',
      shouldRequireConfirmation: false,
    },
  };

  describe('evaluatePrompt', () => {
    it('should correctly evaluate matching response', () => {
      const response: MockResponse = {
        toolCall: {
          toolName: 'list_customers',
          parameters: {},
        },
        message: 'Here are your customers',
        requiresConfirmation: false,
      };

      const details = evaluatePrompt(mockPrompt, response);

      expect(details.toolSelectionCorrect).toBe(true);
      expect(details.confirmationCorrect).toBe(true);
    });

    it('should detect wrong tool selection', () => {
      const response: MockResponse = {
        toolCall: {
          toolName: 'list_vendors',
          parameters: {},
        },
        message: 'Here are your vendors',
        requiresConfirmation: false,
      };

      const details = evaluatePrompt(mockPrompt, response);

      expect(details.toolSelectionCorrect).toBe(false);
      expect(details.expectedTool).toBe('list_customers');
      expect(details.actualTool).toBe('list_vendors');
    });

    it('should check tool prefix matching', () => {
      const prefixPrompt: GoldenPrompt = {
        ...mockPrompt,
        expectedBehavior: {
          expectedToolPrefix: 'list_',
        },
      };

      const response: MockResponse = {
        toolCall: {
          toolName: 'list_vendors',
          parameters: {},
        },
        message: 'Results',
      };

      const details = evaluatePrompt(prefixPrompt, response);
      expect(details.toolSelectionCorrect).toBe(true);
    });

    it('should check forbidden tools', () => {
      const forbiddenPrompt: GoldenPrompt = {
        ...mockPrompt,
        expectedBehavior: {
          forbiddenTools: ['delete_customer'],
        },
      };

      const response: MockResponse = {
        toolCall: {
          toolName: 'delete_customer',
          parameters: { id: '123' },
        },
        message: 'Deleted',
      };

      const details = evaluatePrompt(forbiddenPrompt, response);
      expect(details.toolSelectionCorrect).toBe(false);
      expect(details.errorDetails).toContain('forbidden');
    });

    it('should check required parameters', () => {
      const paramPrompt: GoldenPrompt = {
        ...mockPrompt,
        expectedBehavior: {
          expectedTool: 'create_customer',
          requiredParameterKeys: ['companyName', 'email'],
        },
      };

      const response: MockResponse = {
        toolCall: {
          toolName: 'create_customer',
          parameters: { companyName: 'Test' },
        },
        message: 'Creating',
      };

      const details = evaluatePrompt(paramPrompt, response);
      expect(details.parametersValid).toBe(false);
      expect(details.missingParameters).toContain('email');
    });

    it('should check response content', () => {
      const contentPrompt: GoldenPrompt = {
        ...mockPrompt,
        expectedBehavior: {
          responseContains: ['confirm', 'create'],
          responseNotContains: ['error'],
        },
      };

      const response: MockResponse = {
        message: 'Please confirm you want to create this',
      };

      const details = evaluatePrompt(contentPrompt, response);
      expect(details.responseContentCorrect).toBe(true);
    });

    it('should detect missing content', () => {
      const contentPrompt: GoldenPrompt = {
        ...mockPrompt,
        expectedBehavior: {
          responseContains: ['confirm', 'create', 'important'],
        },
      };

      const response: MockResponse = {
        message: 'Please confirm',
      };

      const details = evaluatePrompt(contentPrompt, response);
      expect(details.missingContent).toContain('create');
      expect(details.missingContent).toContain('important');
    });
  });

  describe('didPass', () => {
    it('should pass when all criteria met', () => {
      const details = {
        toolSelectionCorrect: true,
        confirmationCorrect: true,
      };
      const expected = {
        expectedTool: 'list_customers',
        shouldRequireConfirmation: false,
      };

      expect(didPass(details, expected)).toBe(true);
    });

    it('should fail when tool selection wrong', () => {
      const details = {
        toolSelectionCorrect: false,
      };
      const expected = {
        expectedTool: 'list_customers',
      };

      expect(didPass(details, expected)).toBe(false);
    });

    it('should fail when missing content', () => {
      const details = {
        missingContent: ['important'],
      };
      const expected = {
        responseContains: ['important'],
      };

      expect(didPass(details, expected)).toBe(false);
    });
  });

  describe('scoreResult', () => {
    it('should give full score for correct tool selection', () => {
      const expected = { expectedTool: 'list_customers' };
      const response: MockResponse = {
        toolCall: { toolName: 'list_customers', parameters: {} },
        message: 'Results',
      };
      const details = { toolSelectionCorrect: true };

      const { score, maxScore } = scoreResult(expected, response, details);

      expect(score).toBe(40); // Tool selection weight
      expect(maxScore).toBe(40);
    });

    it('should give partial credit for some parameters', () => {
      const expected = {
        expectedTool: 'create_customer',
        requiredParameterKeys: ['name', 'email', 'phone'],
      };
      const response: MockResponse = {
        toolCall: { toolName: 'create_customer', parameters: { name: 'Test' } },
        message: 'Creating',
      };
      const details = {
        toolSelectionCorrect: true,
        parametersValid: false,
        missingParameters: ['email', 'phone'],
      };

      const { score, maxScore } = scoreResult(expected, response, details);

      // Should get tool score (40) + partial param score (1/3 of 20 = ~7)
      expect(score).toBeGreaterThan(40);
      expect(score).toBeLessThan(60);
    });
  });
});

describe('Evaluation Harness', () => {
  describe('runEvalHarness', () => {
    it('should run prompts and return summary', async () => {
      const mockHandler = vi.fn().mockResolvedValue({
        toolCall: { toolName: 'list_customers', parameters: {} },
        message: 'Here are your customers',
        requiresConfirmation: false,
      });

      const summary = await runEvalHarness(mockHandler, {
        prompts: [TOOL_SELECTION_PROMPTS[0]], // Just run one prompt
      });

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(summary.totalPrompts).toBe(1);
    });

    it('should report progress', async () => {
      const mockHandler = vi.fn().mockResolvedValue({
        message: 'Response',
      });

      const progressUpdates: number[] = [];
      await runEvalHarness(mockHandler, {
        prompts: TOOL_SELECTION_PROMPTS.slice(0, 3),
        onProgress: (progress) => {
          progressUpdates.push(progress.current);
        },
      });

      expect(progressUpdates).toEqual([1, 2, 3]);
    });

    it('should filter by category', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ message: 'Response' });

      const summary = await runEvalHarness(mockHandler, {
        categories: ['tool_selection'],
      });

      expect(summary.totalPrompts).toBe(TOOL_SELECTION_PROMPTS.length);
    });

    it('should handle timeouts', async () => {
      const slowHandler = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ message: 'Late' }), 5000))
      );

      const summary = await runEvalHarness(slowHandler, {
        prompts: [TOOL_SELECTION_PROMPTS[0]],
        timeout: 100, // Very short timeout
      });

      expect(summary.totalFailed).toBe(1);
      expect(summary.failedPrompts[0].details.errorDetails).toContain('Timeout');
    });
  });

  describe('calculateSummary', () => {
    it('should calculate correct statistics', () => {
      const results: EvalResult[] = [
        {
          promptId: 'ts-001',
          prompt: 'Test 1',
          category: 'tool_selection',
          passed: true,
          score: 100,
          maxScore: 100,
          details: {},
          durationMs: 50,
          timestamp: new Date(),
        },
        {
          promptId: 'ts-002',
          prompt: 'Test 2',
          category: 'tool_selection',
          passed: false,
          score: 40,
          maxScore: 100,
          details: {},
          durationMs: 60,
          timestamp: new Date(),
        },
        {
          promptId: 'vr-001',
          prompt: 'Test 3',
          category: 'validation_recovery',
          passed: true,
          score: 80,
          maxScore: 100,
          details: {},
          durationMs: 70,
          timestamp: new Date(),
        },
      ];

      const summary = calculateSummary(results, 180);

      expect(summary.totalPrompts).toBe(3);
      expect(summary.totalPassed).toBe(2);
      expect(summary.totalFailed).toBe(1);
      expect(summary.passRate).toBeCloseTo(66.67, 1);
      expect(summary.totalScore).toBe(220);
      expect(summary.maxPossibleScore).toBe(300);
      expect(summary.byCategory.tool_selection.total).toBe(2);
      expect(summary.byCategory.validation_recovery.total).toBe(1);
    });
  });

  describe('compareToBaseline', () => {
    it('should detect improvements and regressions', () => {
      const baseline: EvalSummary = {
        totalPrompts: 3,
        totalPassed: 2,
        totalFailed: 1,
        passRate: 66.67,
        totalScore: 200,
        maxPossibleScore: 300,
        scorePercentage: 66.67,
        byCategory: {} as any,
        failedPrompts: [{ promptId: 'ts-001' }] as any,
        timestamp: new Date(),
        durationMs: 100,
      };

      const current: EvalSummary = {
        totalPrompts: 3,
        totalPassed: 2,
        totalFailed: 1,
        passRate: 66.67,
        totalScore: 200,
        maxPossibleScore: 300,
        scorePercentage: 66.67,
        byCategory: {} as any,
        failedPrompts: [{ promptId: 'ts-002' }] as any, // Different failure
        timestamp: new Date(),
        durationMs: 100,
      };

      const comparison = compareToBaseline(current, baseline);

      expect(comparison.improved).toContain('ts-001'); // Was failing, now passing
      expect(comparison.regressed).toContain('ts-002'); // Was passing, now failing
    });
  });

  describe('formatSummaryMarkdown', () => {
    it('should generate valid markdown', () => {
      const summary: EvalSummary = {
        totalPrompts: 10,
        totalPassed: 8,
        totalFailed: 2,
        passRate: 80,
        totalScore: 800,
        maxPossibleScore: 1000,
        scorePercentage: 80,
        byCategory: {
          tool_selection: { total: 5, passed: 4, failed: 1, passRate: 80, avgScore: 85 },
          validation_recovery: { total: 5, passed: 4, failed: 1, passRate: 80, avgScore: 75 },
        } as any,
        failedPrompts: [
          { promptId: 'ts-001', prompt: 'Test', category: 'tool_selection', score: 0, maxScore: 100, details: {} },
        ] as any,
        timestamp: new Date(),
        durationMs: 1000,
      };

      const md = formatSummaryMarkdown(summary);

      expect(md).toContain('# AI Tool Evaluation Report');
      expect(md).toContain('Total Prompts | 10');
      expect(md).toContain('Pass Rate | 80.0%');
      expect(md).toContain('## By Category');
      expect(md).toContain('## Failed Prompts');
      expect(md).toContain('ts-001');
    });
  });
});
