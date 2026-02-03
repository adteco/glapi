/**
 * AI Tool Evaluation Module
 *
 * Provides golden prompts and evaluation harness for testing
 * AI tool selection, validation, and behavior.
 */

// Golden Prompts
export {
  ALL_GOLDEN_PROMPTS,
  TOOL_SELECTION_PROMPTS,
  VALIDATION_RECOVERY_PROMPTS,
  CONFIRMATION_COMPLIANCE_PROMPTS,
  PERMISSION_HANDLING_PROMPTS,
  ERROR_HANDLING_PROMPTS,
  MULTI_STEP_PROMPTS,
  AMBIGUITY_HANDLING_PROMPTS,
  getPromptsByCategory,
  getPromptsByTag,
  getPromptById,
  type GoldenPrompt,
  type EvalCategory,
  type ExpectedBehavior,
} from './golden-prompts';

// Evaluation Harness
export {
  runEvalHarness,
  evaluatePrompt,
  scoreResult,
  didPass,
  calculateSummary,
  compareToBaseline,
  formatSummaryMarkdown,
  formatComparisonMarkdown,
  type EvalConfig,
  type EvalProgress,
  type EvalResult,
  type EvalDetails,
  type EvalSummary,
  type CategorySummary,
  type MockToolCall,
  type MockResponse,
  type PromptHandler,
  type BaselineComparison,
} from './eval-harness';
