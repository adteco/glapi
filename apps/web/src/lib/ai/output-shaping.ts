/**
 * Output Shaping and Redaction for AI Tool Responses
 *
 * Applies field filtering, redaction, and limiting based on x-ai-output metadata.
 * This ensures AI responses are:
 * - Minimized to only requested fields (includeFields)
 * - Sensitive data is masked (redactFields)
 * - Arrays are limited (maxItems)
 * - Token budgets are respected (maxTokens)
 *
 * IMPORTANT: Redaction happens BEFORE logging/auditing to prevent PII leaks.
 *
 * @module @glapi/web/ai/output-shaping
 */

// =============================================================================
// Types
// =============================================================================

export interface OutputConfig {
  /** Allowlist of fields to include in response (dot notation supported) */
  includeFields?: string[];
  /** Fields to redact/mask in response (dot notation supported) */
  redactFields?: string[];
  /** Maximum array items to return */
  maxItems?: number;
  /** Approximate token budget for response */
  maxTokens?: number;
}

export interface ShapingStats {
  fieldsIncluded: number;
  fieldsRedacted: number;
  itemsLimited: number;
  tokensTruncated: boolean;
  originalSize: number;
  shapedSize: number;
}

export interface ShapingResult<T = unknown> {
  data: T;
  stats: ShapingStats;
}

// =============================================================================
// Constants
// =============================================================================

const REDACTED_VALUE = '[REDACTED]';
const CHARS_PER_TOKEN = 4; // Rough approximation for token estimation

// PII field patterns that should always be redacted when redactFields is empty
// but the tool has output config (defensive default)
const DEFAULT_PII_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /apiKey/i,
  /api_key/i,
  /ssn/i,
  /socialSecurity/i,
  /social_security/i,
  /creditCard/i,
  /credit_card/i,
  /cardNumber/i,
  /card_number/i,
  /cvv/i,
  /cvc/i,
  /pin/i,
  /privateKey/i,
  /private_key/i,
];

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Apply output shaping to tool response data
 *
 * @param data - Raw response data from tool execution
 * @param config - Output configuration from tool metadata
 * @returns Shaped data with statistics
 */
export function applyOutputShaping<T = unknown>(
  data: T,
  config?: OutputConfig
): ShapingResult<T> {
  const stats: ShapingStats = {
    fieldsIncluded: 0,
    fieldsRedacted: 0,
    itemsLimited: 0,
    tokensTruncated: false,
    originalSize: estimateSize(data),
    shapedSize: 0,
  };

  // If no config, return data as-is with default PII redaction
  if (!config) {
    const redactedData = applyDefaultPiiRedaction(data, stats);
    stats.shapedSize = estimateSize(redactedData);
    return { data: redactedData as T, stats };
  }

  let shapedData: unknown = data;

  // Step 1: Apply field inclusion (whitelist filtering)
  if (config.includeFields && config.includeFields.length > 0) {
    shapedData = filterFields(shapedData, config.includeFields, stats);
  }

  // Step 2: Apply field redaction
  if (config.redactFields && config.redactFields.length > 0) {
    shapedData = redactFields(shapedData, config.redactFields, stats);
  } else {
    // Apply default PII redaction if no explicit redactFields
    shapedData = applyDefaultPiiRedaction(shapedData, stats);
  }

  // Step 3: Apply array limiting
  if (config.maxItems && config.maxItems > 0) {
    shapedData = limitArrayItems(shapedData, config.maxItems, stats);
  }

  // Step 4: Apply token limiting
  if (config.maxTokens && config.maxTokens > 0) {
    shapedData = truncateToTokenBudget(shapedData, config.maxTokens, stats);
  }

  stats.shapedSize = estimateSize(shapedData);

  return { data: shapedData as T, stats };
}

/**
 * Filter object to only include specified fields
 */
function filterFields(data: unknown, includeFields: string[], stats: ShapingStats): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => filterFields(item, includeFields, stats));
  }

  if (typeof data !== 'object') {
    return data;
  }

  const result: Record<string, unknown> = {};
  const obj = data as Record<string, unknown>;

  for (const field of includeFields) {
    const value = getNestedValue(obj, field);
    if (value !== undefined) {
      setNestedValue(result, field, value);
      stats.fieldsIncluded++;
    }
  }

  return result;
}

/**
 * Redact specified fields in object
 */
function redactFields(data: unknown, redactFieldList: string[], stats: ShapingStats): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactFields(item, redactFieldList, stats));
  }

  if (typeof data !== 'object') {
    return data;
  }

  const result = { ...data } as Record<string, unknown>;

  for (const field of redactFieldList) {
    if (hasNestedValue(result, field)) {
      setNestedValue(result, field, REDACTED_VALUE);
      stats.fieldsRedacted++;
    }
  }

  // Recursively redact nested objects
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'object' && value !== null) {
      result[key] = redactFields(value, redactFieldList, stats);
    }
  }

  return result;
}

/**
 * Apply default PII redaction for common sensitive field patterns
 */
function applyDefaultPiiRedaction(data: unknown, stats: ShapingStats): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => applyDefaultPiiRedaction(item, stats));
  }

  if (typeof data !== 'object') {
    return data;
  }

  const result = { ...data } as Record<string, unknown>;

  for (const [key, value] of Object.entries(result)) {
    // Check if key matches any PII pattern
    const isPii = DEFAULT_PII_PATTERNS.some((pattern) => pattern.test(key));

    if (isPii && value !== null && value !== undefined) {
      result[key] = REDACTED_VALUE;
      stats.fieldsRedacted++;
    } else if (typeof value === 'object' && value !== null) {
      result[key] = applyDefaultPiiRedaction(value, stats);
    }
  }

  return result;
}

/**
 * Limit array items to maxItems
 */
function limitArrayItems(data: unknown, maxItems: number, stats: ShapingStats): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    if (data.length > maxItems) {
      stats.itemsLimited += data.length - maxItems;
      return data.slice(0, maxItems).map((item) => limitArrayItems(item, maxItems, stats));
    }
    return data.map((item) => limitArrayItems(item, maxItems, stats));
  }

  if (typeof data !== 'object') {
    return data;
  }

  const result = { ...data } as Record<string, unknown>;

  for (const [key, value] of Object.entries(result)) {
    result[key] = limitArrayItems(value, maxItems, stats);
  }

  return result;
}

/**
 * Truncate data to fit within token budget
 */
function truncateToTokenBudget(data: unknown, maxTokens: number, stats: ShapingStats): unknown {
  const json = JSON.stringify(data);
  const estimatedTokens = Math.ceil(json.length / CHARS_PER_TOKEN);

  if (estimatedTokens <= maxTokens) {
    return data;
  }

  stats.tokensTruncated = true;

  // For arrays, progressively reduce items
  if (Array.isArray(data)) {
    let truncatedArray = [...data];

    while (truncatedArray.length > 1) {
      truncatedArray = truncatedArray.slice(0, Math.ceil(truncatedArray.length * 0.75));
      const newJson = JSON.stringify(truncatedArray);
      const newTokens = Math.ceil(newJson.length / CHARS_PER_TOKEN);

      if (newTokens <= maxTokens) {
        return truncatedArray;
      }
    }

    // If single item still too large, truncate string fields
    return truncateObjectStrings(truncatedArray[0], maxTokens);
  }

  // For objects, truncate string fields
  return truncateObjectStrings(data, maxTokens);
}

/**
 * Truncate string fields in object to fit token budget
 */
function truncateObjectStrings(data: unknown, maxTokens: number): unknown {
  if (typeof data !== 'object' || data === null) {
    if (typeof data === 'string') {
      const maxChars = maxTokens * CHARS_PER_TOKEN;
      if (data.length > maxChars) {
        return data.slice(0, maxChars - 3) + '...';
      }
    }
    return data;
  }

  const result = Array.isArray(data) ? [...data] : { ...data };

  for (const [key, value] of Object.entries(result as Record<string, unknown>)) {
    (result as Record<string, unknown>)[key] = truncateObjectStrings(value, maxTokens);
  }

  return result;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set nested value in object using dot notation
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Check if nested value exists in object
 */
function hasNestedValue(obj: Record<string, unknown>, path: string): boolean {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return false;
    }
    if (!(part in (current as Record<string, unknown>))) {
      return false;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return true;
}

/**
 * Estimate size of data in bytes (for stats)
 */
function estimateSize(data: unknown): number {
  try {
    return JSON.stringify(data).length;
  } catch {
    return 0;
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Quick check if any output shaping is configured
 */
export function hasOutputConfig(config?: OutputConfig): boolean {
  if (!config) return false;

  return !!(
    (config.includeFields && config.includeFields.length > 0) ||
    (config.redactFields && config.redactFields.length > 0) ||
    config.maxItems ||
    config.maxTokens
  );
}

/**
 * Merge multiple output configs (useful for layered policies)
 */
export function mergeOutputConfigs(...configs: (OutputConfig | undefined)[]): OutputConfig {
  const merged: OutputConfig = {};

  for (const config of configs) {
    if (!config) continue;

    // For includeFields, use intersection (most restrictive)
    if (config.includeFields) {
      if (merged.includeFields) {
        merged.includeFields = merged.includeFields.filter((f) =>
          config.includeFields!.includes(f)
        );
      } else {
        merged.includeFields = [...config.includeFields];
      }
    }

    // For redactFields, use union (redact all)
    if (config.redactFields) {
      merged.redactFields = Array.from(
        new Set([...(merged.redactFields || []), ...config.redactFields])
      );
    }

    // For limits, use minimum (most restrictive)
    if (config.maxItems !== undefined) {
      merged.maxItems = Math.min(merged.maxItems ?? Infinity, config.maxItems);
    }

    if (config.maxTokens !== undefined) {
      merged.maxTokens = Math.min(merged.maxTokens ?? Infinity, config.maxTokens);
    }
  }

  return merged;
}
