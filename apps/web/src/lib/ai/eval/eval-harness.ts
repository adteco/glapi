/**
 * AI Tool Evaluation Harness
 *
 * Runs golden prompts against the AI tool system and scores results.
 * Supports CI integration and baseline comparison.
 */

import type { GoldenPrompt, ExpectedBehavior, EvalCategory } from './golden-prompts';
import { ALL_GOLDEN_PROMPTS, getPromptsByCategory, getPromptsByTag } from './golden-prompts';
import { AI_TOOLS_BY_NAME } from '../generated/generated-tools';
import type { UserRole } from '../generated/generated-tools';

// =============================================================================
// Types
// =============================================================================

export interface EvalConfig {
  prompts?: GoldenPrompt[];
  categories?: EvalCategory[];
  tags?: string[];
  userRole?: UserRole;
  verbose?: boolean;
  timeout?: number;
  onProgress?: (progress: EvalProgress) => void;
}

export interface EvalProgress {
  current: number;
  total: number;
  currentPrompt: GoldenPrompt;
}

export interface EvalResult {
  promptId: string;
  prompt: string;
  category: EvalCategory;
  passed: boolean;
  score: number;
  maxScore: number;
  details: EvalDetails;
  durationMs: number;
  timestamp: Date;
}

export interface EvalDetails {
  toolSelectionCorrect?: boolean;
  expectedTool?: string;
  actualTool?: string;
  parametersValid?: boolean;
  missingParameters?: string[];
  confirmationCorrect?: boolean;
  riskLevelCorrect?: boolean;
  responseContentCorrect?: boolean;
  missingContent?: string[];
  forbiddenContent?: string[];
  errorHandlingCorrect?: boolean;
  errorDetails?: string;
}

export interface EvalSummary {
  totalPrompts: number;
  totalPassed: number;
  totalFailed: number;
  passRate: number;
  totalScore: number;
  maxPossibleScore: number;
  scorePercentage: number;
  byCategory: Record<EvalCategory, CategorySummary>;
  failedPrompts: EvalResult[];
  timestamp: Date;
  durationMs: number;
}

export interface CategorySummary {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  avgScore: number;
}

export interface MockToolCall {
  toolName: string;
  parameters: Record<string, unknown>;
}

export interface MockResponse {
  toolCall?: MockToolCall;
  message: string;
  requiresConfirmation?: boolean;
  error?: {
    code: string;
    message: string;
  };
}

export type PromptHandler = (
  prompt: string,
  userRole: UserRole
) => Promise<MockResponse>;

// =============================================================================
// Scoring Functions
// =============================================================================

const SCORE_WEIGHTS = {
  toolSelection: 40,
  parameters: 20,
  confirmation: 15,
  riskLevel: 10,
  responseContent: 15,
};

/**
 * Score a single evaluation result.
 */
export function scoreResult(
  expected: ExpectedBehavior,
  actual: MockResponse,
  details: EvalDetails
): { score: number; maxScore: number } {
  let score = 0;
  let maxScore = 0;

  // Tool selection scoring
  if (expected.expectedTool || expected.expectedToolPrefix) {
    maxScore += SCORE_WEIGHTS.toolSelection;
    if (details.toolSelectionCorrect) {
      score += SCORE_WEIGHTS.toolSelection;
    }
  }

  // Parameters scoring
  if (expected.requiredParameterKeys?.length) {
    maxScore += SCORE_WEIGHTS.parameters;
    if (details.parametersValid) {
      score += SCORE_WEIGHTS.parameters;
    } else if (details.missingParameters) {
      // Partial credit based on how many parameters were correct
      const totalRequired = expected.requiredParameterKeys.length;
      const missing = details.missingParameters.length;
      const present = totalRequired - missing;
      score += Math.round((present / totalRequired) * SCORE_WEIGHTS.parameters);
    }
  }

  // Confirmation scoring
  if (expected.shouldRequireConfirmation !== undefined) {
    maxScore += SCORE_WEIGHTS.confirmation;
    if (details.confirmationCorrect) {
      score += SCORE_WEIGHTS.confirmation;
    }
  }

  // Risk level scoring
  if (expected.expectedRiskLevel) {
    maxScore += SCORE_WEIGHTS.riskLevel;
    if (details.riskLevelCorrect) {
      score += SCORE_WEIGHTS.riskLevel;
    }
  }

  // Response content scoring
  if (expected.responseContains?.length || expected.responseNotContains?.length) {
    maxScore += SCORE_WEIGHTS.responseContent;
    if (details.responseContentCorrect) {
      score += SCORE_WEIGHTS.responseContent;
    } else {
      // Partial credit
      const totalChecks =
        (expected.responseContains?.length ?? 0) +
        (expected.responseNotContains?.length ?? 0);
      const failed =
        (details.missingContent?.length ?? 0) +
        (details.forbiddenContent?.length ?? 0);
      const passed = totalChecks - failed;
      score += Math.round((passed / totalChecks) * SCORE_WEIGHTS.responseContent);
    }
  }

  // If no specific expectations, give default score for getting a response
  if (maxScore === 0) {
    maxScore = 100;
    if (!actual.error || expected.shouldFail) {
      score = 100;
    }
  }

  return { score, maxScore };
}

// =============================================================================
// Evaluation Logic
// =============================================================================

/**
 * Evaluate a single prompt against expected behavior.
 */
export function evaluatePrompt(
  prompt: GoldenPrompt,
  response: MockResponse
): EvalDetails {
  const expected = prompt.expectedBehavior;
  const details: EvalDetails = {};

  // Check tool selection
  if (expected.expectedTool || expected.expectedToolPrefix) {
    const actualTool = response.toolCall?.toolName;
    details.expectedTool = expected.expectedTool ?? `${expected.expectedToolPrefix}*`;
    details.actualTool = actualTool;

    if (expected.expectedTool) {
      details.toolSelectionCorrect = actualTool === expected.expectedTool;
    } else if (expected.expectedToolPrefix && actualTool) {
      details.toolSelectionCorrect = actualTool.startsWith(expected.expectedToolPrefix);
    } else {
      details.toolSelectionCorrect = false;
    }
  }

  // Check forbidden tools
  if (expected.forbiddenTools?.length && response.toolCall) {
    if (expected.forbiddenTools.includes(response.toolCall.toolName)) {
      details.toolSelectionCorrect = false;
      details.errorDetails = `Used forbidden tool: ${response.toolCall.toolName}`;
    }
  }

  // Check parameters
  if (expected.requiredParameterKeys?.length && response.toolCall) {
    const actualParams = response.toolCall.parameters;
    const missing = expected.requiredParameterKeys.filter(
      (key) => !(key in actualParams)
    );
    details.parametersValid = missing.length === 0;
    if (missing.length > 0) {
      details.missingParameters = missing;
    }
  }

  // Check confirmation requirement
  if (expected.shouldRequireConfirmation !== undefined) {
    details.confirmationCorrect =
      response.requiresConfirmation === expected.shouldRequireConfirmation;
  }

  // Check risk level
  if (expected.expectedRiskLevel && response.toolCall) {
    const tool = AI_TOOLS_BY_NAME.get(response.toolCall.toolName);
    details.riskLevelCorrect = tool?.metadata.risk.level === expected.expectedRiskLevel;
  }

  // Check response content
  if (expected.responseContains?.length) {
    const message = response.message.toLowerCase();
    const missing = expected.responseContains.filter(
      (text) => !message.includes(text.toLowerCase())
    );
    details.missingContent = missing.length > 0 ? missing : undefined;
    details.responseContentCorrect = missing.length === 0;
  }

  if (expected.responseNotContains?.length) {
    const message = response.message.toLowerCase();
    const found = expected.responseNotContains.filter((text) =>
      message.includes(text.toLowerCase())
    );
    details.forbiddenContent = found.length > 0 ? found : undefined;
    if (found.length > 0) {
      details.responseContentCorrect = false;
    }
  }

  // Check error handling
  if (expected.shouldFail) {
    details.errorHandlingCorrect = !!response.error;
    if (expected.expectedErrorCode) {
      details.errorHandlingCorrect =
        response.error?.code === expected.expectedErrorCode;
    }
  }

  return details;
}

/**
 * Determine if the evaluation passed.
 */
export function didPass(details: EvalDetails, expected: ExpectedBehavior): boolean {
  // Tool selection must be correct if expected
  if ((expected.expectedTool || expected.expectedToolPrefix) && !details.toolSelectionCorrect) {
    return false;
  }

  // Parameters must be valid if required
  if (expected.requiredParameterKeys?.length && !details.parametersValid) {
    return false;
  }

  // Confirmation must be correct if specified
  if (expected.shouldRequireConfirmation !== undefined && !details.confirmationCorrect) {
    return false;
  }

  // Error handling must be correct if expected to fail
  if (expected.shouldFail && !details.errorHandlingCorrect) {
    return false;
  }

  // Response content checks
  if (details.missingContent?.length || details.forbiddenContent?.length) {
    return false;
  }

  return true;
}

// =============================================================================
// Harness Runner
// =============================================================================

/**
 * Run the evaluation harness.
 */
export async function runEvalHarness(
  handler: PromptHandler,
  config: EvalConfig = {}
): Promise<EvalSummary> {
  const startTime = Date.now();

  // Determine which prompts to run
  let prompts = config.prompts ?? ALL_GOLDEN_PROMPTS;

  if (config.categories?.length) {
    prompts = prompts.filter((p) => config.categories!.includes(p.category));
  }

  if (config.tags?.length) {
    prompts = prompts.filter((p) =>
      config.tags!.some((tag) => p.tags?.includes(tag))
    );
  }

  const userRole = config.userRole ?? 'staff';
  const results: EvalResult[] = [];

  // Run each prompt
  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];

    if (config.onProgress) {
      config.onProgress({
        current: i + 1,
        total: prompts.length,
        currentPrompt: prompt,
      });
    }

    const promptStartTime = Date.now();

    try {
      // Get response from handler
      const response = await Promise.race([
        handler(prompt.prompt, userRole),
        new Promise<MockResponse>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), config.timeout ?? 30000)
        ),
      ]);

      // Evaluate the response
      const details = evaluatePrompt(prompt, response);
      const passed = didPass(details, prompt.expectedBehavior);
      const { score, maxScore } = scoreResult(prompt.expectedBehavior, response, details);

      results.push({
        promptId: prompt.id,
        prompt: prompt.prompt,
        category: prompt.category,
        passed,
        score,
        maxScore,
        details,
        durationMs: Date.now() - promptStartTime,
        timestamp: new Date(),
      });
    } catch (error) {
      // Handle timeout or other errors
      results.push({
        promptId: prompt.id,
        prompt: prompt.prompt,
        category: prompt.category,
        passed: false,
        score: 0,
        maxScore: 100,
        details: {
          errorDetails: error instanceof Error ? error.message : 'Unknown error',
        },
        durationMs: Date.now() - promptStartTime,
        timestamp: new Date(),
      });
    }
  }

  // Calculate summary
  return calculateSummary(results, Date.now() - startTime);
}

/**
 * Calculate summary statistics from results.
 */
export function calculateSummary(
  results: EvalResult[],
  durationMs: number
): EvalSummary {
  const totalPrompts = results.length;
  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = totalPrompts - totalPassed;
  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  const maxPossibleScore = results.reduce((sum, r) => sum + r.maxScore, 0);

  // Calculate by category
  const byCategory: Record<string, CategorySummary> = {};
  const categories = [...new Set(results.map((r) => r.category))];

  for (const category of categories) {
    const categoryResults = results.filter((r) => r.category === category);
    const passed = categoryResults.filter((r) => r.passed).length;
    const total = categoryResults.length;
    const avgScore =
      categoryResults.reduce((sum, r) => sum + r.score / r.maxScore, 0) /
      (total || 1);

    byCategory[category] = {
      total,
      passed,
      failed: total - passed,
      passRate: total > 0 ? (passed / total) * 100 : 0,
      avgScore: avgScore * 100,
    };
  }

  return {
    totalPrompts,
    totalPassed,
    totalFailed,
    passRate: totalPrompts > 0 ? (totalPassed / totalPrompts) * 100 : 0,
    totalScore,
    maxPossibleScore,
    scorePercentage: maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0,
    byCategory: byCategory as Record<EvalCategory, CategorySummary>,
    failedPrompts: results.filter((r) => !r.passed),
    timestamp: new Date(),
    durationMs,
  };
}

// =============================================================================
// Baseline Comparison
// =============================================================================

export interface BaselineComparison {
  current: EvalSummary;
  baseline: EvalSummary;
  improved: string[];
  regressed: string[];
  passRateDelta: number;
  scoreDelta: number;
}

/**
 * Compare current results against a baseline.
 */
export function compareToBaseline(
  current: EvalSummary,
  baseline: EvalSummary
): BaselineComparison {
  const currentFailed = new Set(current.failedPrompts.map((r) => r.promptId));
  const baselineFailed = new Set(baseline.failedPrompts.map((r) => r.promptId));

  const improved: string[] = [];
  const regressed: string[] = [];

  // Find improvements (was failing, now passing)
  for (const id of baselineFailed) {
    if (!currentFailed.has(id)) {
      improved.push(id);
    }
  }

  // Find regressions (was passing, now failing)
  for (const id of currentFailed) {
    if (!baselineFailed.has(id)) {
      regressed.push(id);
    }
  }

  return {
    current,
    baseline,
    improved,
    regressed,
    passRateDelta: current.passRate - baseline.passRate,
    scoreDelta: current.scorePercentage - baseline.scorePercentage,
  };
}

// =============================================================================
// Formatters
// =============================================================================

/**
 * Format summary as markdown for reports.
 */
export function formatSummaryMarkdown(summary: EvalSummary): string {
  let md = `# AI Tool Evaluation Report\n\n`;
  md += `**Date:** ${summary.timestamp.toISOString()}\n`;
  md += `**Duration:** ${summary.durationMs}ms\n\n`;

  md += `## Overall Results\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Prompts | ${summary.totalPrompts} |\n`;
  md += `| Passed | ${summary.totalPassed} |\n`;
  md += `| Failed | ${summary.totalFailed} |\n`;
  md += `| Pass Rate | ${summary.passRate.toFixed(1)}% |\n`;
  md += `| Score | ${summary.totalScore}/${summary.maxPossibleScore} (${summary.scorePercentage.toFixed(1)}%) |\n`;

  md += `\n## By Category\n\n`;
  md += `| Category | Total | Passed | Failed | Pass Rate | Avg Score |\n`;
  md += `|----------|-------|--------|--------|-----------|----------|\n`;

  for (const [category, stats] of Object.entries(summary.byCategory)) {
    md += `| ${category} | ${stats.total} | ${stats.passed} | ${stats.failed} | ${stats.passRate.toFixed(1)}% | ${stats.avgScore.toFixed(1)}% |\n`;
  }

  if (summary.failedPrompts.length > 0) {
    md += `\n## Failed Prompts\n\n`;
    for (const result of summary.failedPrompts) {
      md += `### ${result.promptId}\n`;
      md += `- **Prompt:** ${result.prompt}\n`;
      md += `- **Category:** ${result.category}\n`;
      md += `- **Score:** ${result.score}/${result.maxScore}\n`;
      if (result.details.errorDetails) {
        md += `- **Error:** ${result.details.errorDetails}\n`;
      }
      md += `\n`;
    }
  }

  return md;
}

/**
 * Format comparison as markdown.
 */
export function formatComparisonMarkdown(comparison: BaselineComparison): string {
  let md = `# Baseline Comparison\n\n`;

  md += `## Summary\n\n`;
  md += `| Metric | Baseline | Current | Delta |\n`;
  md += `|--------|----------|---------|-------|\n`;
  md += `| Pass Rate | ${comparison.baseline.passRate.toFixed(1)}% | ${comparison.current.passRate.toFixed(1)}% | ${comparison.passRateDelta >= 0 ? '+' : ''}${comparison.passRateDelta.toFixed(1)}% |\n`;
  md += `| Score | ${comparison.baseline.scorePercentage.toFixed(1)}% | ${comparison.current.scorePercentage.toFixed(1)}% | ${comparison.scoreDelta >= 0 ? '+' : ''}${comparison.scoreDelta.toFixed(1)}% |\n`;

  if (comparison.improved.length > 0) {
    md += `\n## Improvements\n\n`;
    for (const id of comparison.improved) {
      md += `- ${id}\n`;
    }
  }

  if (comparison.regressed.length > 0) {
    md += `\n## Regressions\n\n`;
    for (const id of comparison.regressed) {
      md += `- ${id}\n`;
    }
  }

  return md;
}
