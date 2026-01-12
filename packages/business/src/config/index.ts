/**
 * Configuration Module
 *
 * Contains DSL definitions, parsers, and standard configurations for
 * the GLAPI posting engine and chart of accounts.
 *
 * @module config
 */

// Posting Rules DSL
export {
  // Types
  type PostingRuleSetConfig,
  type PostingRuleDefinition,
  type PostingRuleCondition,
  type PostingAction,
  type AccountRef,
  type AmountRef,
  type DescriptionTemplate,
  type DimensionOverrides,
  type ParsedPostingRule,
  type PostingRuleValidationError,
  // Functions
  parsePostingRule,
  parsePostingRuleSet,
  validatePostingRuleSet,
} from './posting-rules-dsl.js';

// Standard Posting Rule Examples
export {
  revenueRecognitionRules,
  orderToCashRules,
  procureToPayRules,
  multiCurrencyRules,
  periodEndRules,
  standardPostingRuleSets,
  getAllStandardRules,
} from './posting-rules-examples.js';
