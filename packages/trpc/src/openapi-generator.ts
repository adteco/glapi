import { AppRouter } from './router';
import { z } from 'zod';
import type { AIProcedureMeta, ProcedureMeta } from './ai-meta';

/**
 * Custom OpenAPI generator for tRPC routers
 * Generates OpenAPI 3.0 specification from tRPC router definitions
 *
 * Enhanced to emit x-ai-* extensions for AI-enabled endpoints.
 * @see packages/api-service/src/ai/openapi-extensions.ts for extension schemas
 */

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string; description: string }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes: Record<string, any>;
  };
  security: Array<Record<string, string[]>>;
}

interface RouterMeta {
  name: string;
  procedures: Array<{
    name: string;
    type: 'query' | 'mutation';
    input?: z.ZodType<any>;
    output?: z.ZodType<any>;
    meta?: ProcedureMeta;
  }>;
}

/**
 * Convert Zod schema to OpenAPI schema
 */
function zodToOpenAPI(schema: z.ZodType<any> | undefined, name: string = ''): any {
  if (!schema) {
    return { type: 'object' };
  }

  const zodType = (schema._def as any).typeName;

  switch (zodType) {
    case 'ZodString':
      const stringChecks = (schema as z.ZodString)._def.checks || [];
      const stringResult: any = { type: 'string' };

      for (const check of stringChecks) {
        if (check.kind === 'email') stringResult.format = 'email';
        if (check.kind === 'uuid') stringResult.format = 'uuid';
        if (check.kind === 'url') stringResult.format = 'uri';
        if (check.kind === 'min') stringResult.minLength = check.value;
        if (check.kind === 'max') stringResult.maxLength = check.value;
      }

      return stringResult;

    case 'ZodNumber':
      return { type: 'number' };

    case 'ZodBoolean':
      return { type: 'boolean' };

    case 'ZodDate':
      return { type: 'string', format: 'date-time' };

    case 'ZodEnum':
      const enumDef = (schema as z.ZodEnum<any>)._def;
      return {
        type: 'string',
        enum: enumDef.values,
      };

    case 'ZodArray':
      const arrayDef = (schema as z.ZodArray<any>)._def;
      return {
        type: 'array',
        items: zodToOpenAPI(arrayDef.type, `${name}Item`),
      };

    case 'ZodObject':
      const objectDef = (schema as z.ZodObject<any>)._def;
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(objectDef.shape())) {
        const zodValue = value as z.ZodType<any>;
        properties[key] = zodToOpenAPI(zodValue, key);

        // Check if field is required
        if (!zodValue.isOptional()) {
          required.push(key);
        }
      }

      const objectResult: any = {
        type: 'object',
        properties,
      };

      if (required.length > 0) {
        objectResult.required = required;
      }

      return objectResult;

    case 'ZodOptional':
    case 'ZodNullable':
      const innerSchema = (schema as any)._def.innerType;
      const innerOpenAPI = zodToOpenAPI(innerSchema, name);
      if (zodType === 'ZodNullable') {
        innerOpenAPI.nullable = true;
      }
      return innerOpenAPI;

    case 'ZodUnion':
      const unionDef = (schema as z.ZodUnion<any>)._def;
      return {
        oneOf: unionDef.options.map((opt: z.ZodType<any>, idx: number) =>
          zodToOpenAPI(opt, `${name}Option${idx}`)
        ),
      };

    case 'ZodLiteral':
      const literalDef = (schema as z.ZodLiteral<any>)._def;
      return {
        type: typeof literalDef.value,
        enum: [literalDef.value],
      };

    case 'ZodRecord':
      return {
        type: 'object',
        additionalProperties: zodToOpenAPI((schema as any)._def.valueType, `${name}Value`),
      };

    case 'ZodDefault':
      const defaultSchema = (schema as any)._def.innerType;
      const defaultOpenAPI = zodToOpenAPI(defaultSchema, name);
      defaultOpenAPI.default = (schema as any)._def.defaultValue();
      return defaultOpenAPI;

    default:
      return { type: 'object' };
  }
}

/**
 * Convert tRPC procedure type to HTTP method
 */
function getHttpMethod(type: 'query' | 'mutation'): string {
  return type === 'query' ? 'get' : 'post';
}

// =============================================================================
// AI Extension Emitters
// =============================================================================

/**
 * Emit x-ai-tool extension from AI metadata
 */
function emitXAiTool(ai: AIProcedureMeta): Record<string, any> {
  const tool = ai.tool;
  return {
    'x-ai-tool': {
      name: tool.name,
      version: tool.version ?? 1,
      stability: tool.stability ?? 'stable',
      deprecated: tool.deprecated ?? false,
      ...(tool.replacement && { replacement: tool.replacement }),
      description: tool.description,
      scopes: tool.scopes ?? ['global'],
      enabled: tool.enabled ?? true,
      ...(tool.exampleUtterances && { exampleUtterances: tool.exampleUtterances }),
    },
  };
}

/**
 * Emit x-ai-risk extension from AI metadata
 */
function emitXAiRisk(ai: AIProcedureMeta): Record<string, any> {
  const risk = ai.risk;
  return {
    'x-ai-risk': {
      level: risk.level,
      requiresConfirmation: risk.requiresConfirmation ?? false,
      supportsDryRun: risk.supportsDryRun ?? false,
      ...(risk.confirmationMessage && { confirmationMessage: risk.confirmationMessage }),
    },
  };
}

/**
 * Emit x-ai-permissions extension from AI metadata
 */
function emitXAiPermissions(ai: AIProcedureMeta): Record<string, any> {
  return {
    'x-ai-permissions': {
      required: ai.permissions.required,
      minimumRole: ai.permissions.minimumRole,
    },
  };
}

/**
 * Emit optional x-ai-policy extension from AI metadata
 */
function emitXAiPolicy(ai: AIProcedureMeta): Record<string, any> {
  if (!ai.policy) return {};
  const policy = ai.policy;
  return {
    'x-ai-policy': {
      ...(policy.allowTiers && { allowTiers: policy.allowTiers }),
      ...(policy.requireMfaForRisk && { requireMfaForRisk: policy.requireMfaForRisk }),
      ...(policy.rowScope && { rowScope: policy.rowScope }),
      ...(policy.maxAffectedRecords && { maxAffectedRecords: policy.maxAffectedRecords }),
    },
  };
}

/**
 * Emit optional x-ai-rate-limit extension from AI metadata
 */
function emitXAiRateLimit(ai: AIProcedureMeta): Record<string, any> {
  if (!ai.rateLimit) return {};
  const rateLimit = ai.rateLimit;
  return {
    'x-ai-rate-limit': {
      requestsPerMinute: rateLimit.requestsPerMinute,
      ...(rateLimit.burstLimit && { burstLimit: rateLimit.burstLimit }),
      scope: rateLimit.scope ?? 'user',
    },
  };
}

/**
 * Emit optional x-ai-output extension from AI metadata
 */
function emitXAiOutput(ai: AIProcedureMeta): Record<string, any> {
  if (!ai.output) return {};
  const output = ai.output;
  return {
    'x-ai-output': {
      ...(output.includeFields && { includeFields: output.includeFields }),
      ...(output.redactFields && { redactFields: output.redactFields }),
      ...(output.maxItems && { maxItems: output.maxItems }),
      ...(output.maxTokens && { maxTokens: output.maxTokens }),
    },
  };
}

/**
 * Emit optional x-ai-idempotency extension from AI metadata
 */
function emitXAiIdempotency(ai: AIProcedureMeta): Record<string, any> {
  if (!ai.idempotency) return {};
  return {
    'x-ai-idempotency': {
      keySource: ai.idempotency.keySource ?? 'auto',
      ttlSeconds: ai.idempotency.ttlSeconds ?? 86400,
    },
  };
}

/**
 * Emit optional x-ai-timeouts extension from AI metadata
 */
function emitXAiTimeouts(ai: AIProcedureMeta): Record<string, any> {
  if (!ai.timeouts) return {};
  return {
    'x-ai-timeouts': {
      softMs: ai.timeouts.softMs ?? 3000,
      hardMs: ai.timeouts.hardMs ?? 10000,
      retryable: ai.timeouts.retryable ?? true,
    },
  };
}

/**
 * Emit optional x-ai-cache extension from AI metadata
 */
function emitXAiCache(ai: AIProcedureMeta): Record<string, any> {
  if (!ai.cache) return {};
  const cache = ai.cache;
  return {
    'x-ai-cache': {
      enabled: cache.enabled ?? false,
      ttlSeconds: cache.ttlSeconds ?? 300,
      ...(cache.varyBy && { varyBy: cache.varyBy }),
      ...(cache.invalidateOn && { invalidateOn: cache.invalidateOn }),
    },
  };
}

/**
 * Emit optional x-ai-errors extension from AI metadata
 */
function emitXAiErrors(ai: AIProcedureMeta): Record<string, any> {
  if (!ai.errors || ai.errors.length === 0) return {};
  return {
    'x-ai-errors': ai.errors.map((e) => ({
      code: e.code,
      retryable: e.retryable ?? false,
      userSafeMessage: e.userSafeMessage,
    })),
  };
}

/**
 * Emit optional x-ai-async extension from AI metadata
 */
function emitXAiAsync(ai: AIProcedureMeta): Record<string, any> {
  if (!ai.async) return {};
  const async = ai.async;
  return {
    'x-ai-async': {
      enabled: async.enabled ?? false,
      ...(async.statusEndpoint && { statusEndpoint: async.statusEndpoint }),
      terminalStates: async.terminalStates ?? ['succeeded', 'failed', 'canceled'],
      ...(async.polling && {
        polling: {
          minMs: async.polling.minMs ?? 500,
          maxMs: async.polling.maxMs ?? 5000,
        },
      }),
    },
  };
}

/**
 * Emit optional x-ai-financial-limits extension from AI metadata
 */
function emitXAiFinancialLimits(ai: AIProcedureMeta): Record<string, any> {
  if (!ai.financialLimits) return {};
  const limits = ai.financialLimits;
  return {
    'x-ai-financial-limits': {
      ...(limits.staff !== undefined && { staff: limits.staff }),
      ...(limits.manager !== undefined && { manager: limits.manager }),
      ...(limits.accountant !== undefined && { accountant: limits.accountant }),
      ...(limits.admin !== undefined && { admin: limits.admin }),
    },
  };
}

/**
 * Emit all x-ai-* extensions for an AI-enabled procedure
 */
export function emitAIExtensions(ai: AIProcedureMeta): Record<string, any> {
  return {
    ...emitXAiTool(ai),
    ...emitXAiRisk(ai),
    ...emitXAiPermissions(ai),
    ...emitXAiPolicy(ai),
    ...emitXAiRateLimit(ai),
    ...emitXAiOutput(ai),
    ...emitXAiIdempotency(ai),
    ...emitXAiTimeouts(ai),
    ...emitXAiCache(ai),
    ...emitXAiErrors(ai),
    ...emitXAiAsync(ai),
    ...emitXAiFinancialLimits(ai),
  };
}

// =============================================================================
// Route Descriptions
// =============================================================================

/**
 * Generate route metadata with descriptions
 */
const routeDescriptions: Record<string, { description: string; tag: string }> = {
  customers: {
    description: 'Customer management endpoints',
    tag: 'Customers',
  },
  organizations: {
    description: 'Organization management endpoints',
    tag: 'Organizations',
  },
  subsidiaries: {
    description: 'Subsidiary management endpoints',
    tag: 'Subsidiaries',
  },
  departments: {
    description: 'Department management endpoints',
    tag: 'Departments',
  },
  locations: {
    description: 'Location management endpoints',
    tag: 'Locations',
  },
  classes: {
    description: 'Class/Cost Center management endpoints',
    tag: 'Classes',
  },
  items: {
    description: 'Item/Product management endpoints',
    tag: 'Items',
  },
  priceLists: {
    description: 'Price list management endpoints',
    tag: 'Price Lists',
  },
  warehouses: {
    description: 'Warehouse management endpoints',
    tag: 'Warehouses',
  },
  vendors: {
    description: 'Vendor management endpoints',
    tag: 'Vendors',
  },
  accounts: {
    description: 'Chart of accounts management endpoints',
    tag: 'Accounts',
  },
  leads: {
    description: 'Lead management endpoints',
    tag: 'Leads',
  },
  employees: {
    description: 'Employee management endpoints',
    tag: 'Employees',
  },
  prospects: {
    description: 'Prospect management endpoints',
    tag: 'Prospects',
  },
  contacts: {
    description: 'Contact management endpoints',
    tag: 'Contacts',
  },
  unitsOfMeasure: {
    description: 'Unit of measure management endpoints',
    tag: 'Units of Measure',
  },
  businessTransactions: {
    description: 'Business transaction endpoints',
    tag: 'Business Transactions',
  },
  subscriptions: {
    description: 'Subscription management endpoints',
    tag: 'Subscriptions',
  },
  invoices: {
    description: 'Invoice management endpoints',
    tag: 'Invoices',
  },
  payments: {
    description: 'Payment management endpoints',
    tag: 'Payments',
  },
  revenue: {
    description: 'Revenue recognition endpoints',
    tag: 'Revenue',
  },
};

/**
 * Get operation description based on procedure name
 */
function getOperationDescription(resource: string, operation: string): string {
  const descriptions: Record<string, string> = {
    list: `List all ${resource}`,
    get: `Get a specific ${resource} by ID`,
    create: `Create a new ${resource}`,
    update: `Update an existing ${resource}`,
    delete: `Delete a ${resource}`,
    getChildren: `Get child ${resource}`,
    getWarehouseAssignments: `Get warehouse assignments for ${resource}`,
  };

  return descriptions[operation] || `${operation} operation for ${resource}`;
}

// =============================================================================
// Default AI Metadata for CRUD Operations
// =============================================================================

/**
 * Generate default AI metadata for common CRUD operations
 * This provides sensible defaults when procedures don't have explicit AI meta
 */
function getDefaultAIMeta(
  routerName: string,
  operation: string
): AIProcedureMeta | null {
  const resource = routerName.replace(/s$/, ''); // customers -> customer

  switch (operation) {
    case 'list':
      return {
        tool: {
          name: `list_${routerName}`,
          description: `Search and list ${routerName} records`,
          scopes: ['global'],
          version: 1,
          stability: 'stable',
          enabled: true,
        },
        risk: {
          level: 'LOW',
          requiresConfirmation: false,
          supportsDryRun: false,
        },
        permissions: {
          required: [`read:${routerName}`],
          minimumRole: 'viewer',
        },
        cache: {
          enabled: true,
          ttlSeconds: 60,
          varyBy: ['search', 'limit', 'offset'],
        },
        rateLimit: {
          requestsPerMinute: 60,
        },
      };

    case 'get':
      return {
        tool: {
          name: `get_${resource}`,
          description: `Get a specific ${resource} by ID`,
          scopes: ['global'],
          version: 1,
          stability: 'stable',
          enabled: true,
        },
        risk: {
          level: 'LOW',
          requiresConfirmation: false,
          supportsDryRun: false,
        },
        permissions: {
          required: [`read:${routerName}`],
          minimumRole: 'viewer',
        },
        cache: {
          enabled: true,
          ttlSeconds: 60,
          varyBy: ['id'],
        },
        rateLimit: {
          requestsPerMinute: 60,
        },
      };

    case 'create':
      return {
        tool: {
          name: `create_${resource}`,
          description: `Create a new ${resource}`,
          scopes: ['global'],
          version: 1,
          stability: 'stable',
          enabled: true,
        },
        risk: {
          level: 'MEDIUM',
          requiresConfirmation: true,
          supportsDryRun: true,
        },
        permissions: {
          required: [`write:${routerName}`],
          minimumRole: 'staff',
        },
        rateLimit: {
          requestsPerMinute: 30,
        },
        idempotency: {
          keySource: 'auto',
          ttlSeconds: 86400,
        },
      };

    case 'update':
      return {
        tool: {
          name: `update_${resource}`,
          description: `Update an existing ${resource}`,
          scopes: ['global'],
          version: 1,
          stability: 'stable',
          enabled: true,
        },
        risk: {
          level: 'MEDIUM',
          requiresConfirmation: true,
          supportsDryRun: true,
        },
        permissions: {
          required: [`write:${routerName}`],
          minimumRole: 'staff',
        },
        rateLimit: {
          requestsPerMinute: 30,
        },
        idempotency: {
          keySource: 'auto',
          ttlSeconds: 86400,
        },
      };

    case 'delete':
      return {
        tool: {
          name: `delete_${resource}`,
          description: `Delete a ${resource}`,
          scopes: ['global'],
          version: 1,
          stability: 'stable',
          enabled: true,
        },
        risk: {
          level: 'HIGH',
          requiresConfirmation: true,
          supportsDryRun: true,
          confirmationMessage: `Are you sure you want to delete this ${resource}? This action cannot be undone.`,
        },
        permissions: {
          required: [`delete:${routerName}`],
          minimumRole: 'manager',
        },
        rateLimit: {
          requestsPerMinute: 10,
        },
      };

    default:
      return null;
  }
}

// =============================================================================
// OpenAPI Spec Generation
// =============================================================================

export interface GenerateOpenAPIOptions {
  /** Include x-ai-* extensions for AI tooling (default: true) */
  includeAIExtensions?: boolean;
  /** Use default AI metadata for procedures without explicit meta (default: true) */
  useDefaultAIMeta?: boolean;
  /** Custom AI metadata overrides by operationId */
  aiMetaOverrides?: Record<string, AIProcedureMeta>;
}

/**
 * Generate OpenAPI specification from tRPC router
 */
export function generateOpenAPISpec(options: GenerateOpenAPIOptions = {}): OpenAPISpec {
  const {
    includeAIExtensions = true,
    useDefaultAIMeta = true,
    aiMetaOverrides = {},
  } = options;

  const spec: OpenAPISpec = {
    openapi: '3.0.3',
    info: {
      title: 'GLAPI - General Ledger and Accounting API',
      version: '1.0.0',
      description: `
# GLAPI - Comprehensive Accounting and Revenue Recognition API

GLAPI provides a complete accounting dimensions API with advanced revenue recognition capabilities.

## Features

- **Multi-tenant Architecture**: Organization-based data isolation
- **Accounting Dimensions**: Customers, Vendors, Subsidiaries, Departments, Locations, Classes
- **Revenue Recognition**: ASC 606 compliant revenue recognition
- **Inventory Management**: Items, Warehouses, Price Lists
- **Financial Operations**: Invoices, Payments, Subscriptions
- **General Ledger**: Chart of Accounts, GL Transactions
- **AI Integration**: AI-enabled endpoints with x-ai-* extensions for LLM tool calling

## Authentication

All endpoints require authentication using Clerk. Include your authentication token in the Authorization header:

\`\`\`
Authorization: Bearer YOUR_TOKEN
\`\`\`

## AI Extensions

Endpoints with \`x-ai-tool\` extensions can be used by AI assistants for automated operations.
See the x-ai-* extension fields for risk levels, permissions, and rate limits.

## Base URL

The API is accessible at:
- Development: http://localhost:3031/api
- Production: https://api.glapi.io/api
      `.trim(),
    },
    servers: [
      {
        url: 'http://localhost:3031/api',
        description: 'Development server',
      },
      {
        url: 'https://api.glapi.io/api',
        description: 'Production server',
      },
    ],
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {
        ClerkAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Clerk authentication token',
        },
      },
    },
    security: [{ ClerkAuth: [] }],
  };

  // Generate paths for each router
  const routers = Object.keys(routeDescriptions);

  for (const routerName of routers) {
    const routeMeta = routeDescriptions[routerName];

    // Common CRUD operations
    const operations = ['list', 'get', 'create', 'update', 'delete'];

    for (const operation of operations) {
      const path = operation === 'list'
        ? `/api/${routerName}`
        : operation === 'create'
        ? `/api/${routerName}`
        : `/api/${routerName}/{id}`;

      const method = operation === 'list' || operation === 'get' ? 'get' :
                     operation === 'create' ? 'post' :
                     operation === 'update' ? 'put' : 'delete';

      if (!spec.paths[path]) {
        spec.paths[path] = {};
      }

      const operationId = `${routerName}.${operation}`;

      const operationSpec: any = {
        summary: getOperationDescription(routerName, operation),
        tags: [routeMeta.tag],
        operationId,
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid or missing authentication',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      };

      // Add path parameters for non-list operations
      if (operation !== 'list' && operation !== 'create') {
        operationSpec.parameters = [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
            description: `${routerName} ID`,
          },
        ];
      }

      // Add request body for create/update operations
      if (operation === 'create' || operation === 'update') {
        operationSpec.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: `${routerName} data`,
              },
            },
          },
        };
      }

      // Add AI extensions if enabled
      if (includeAIExtensions) {
        // Check for override first, then default meta
        const aiMeta = aiMetaOverrides[operationId]
          ?? (useDefaultAIMeta ? getDefaultAIMeta(routerName, operation) : null);

        if (aiMeta) {
          const aiExtensions = emitAIExtensions(aiMeta);
          Object.assign(operationSpec, aiExtensions);
        }
      }

      spec.paths[path][method] = operationSpec;
    }
  }

  return spec;
}

/**
 * Generate OpenAPI spec as JSON string
 */
export function generateOpenAPIJSON(options?: GenerateOpenAPIOptions): string {
  const spec = generateOpenAPISpec(options);
  return JSON.stringify(spec, null, 2);
}

/**
 * Generate OpenAPI spec as YAML string (simplified)
 */
export function generateOpenAPIYAML(options?: GenerateOpenAPIOptions): string {
  const spec = generateOpenAPISpec(options);

  // Simple YAML conversion (for production, use a proper YAML library)
  function toYAML(obj: any, indent: number = 0): string {
    const spaces = '  '.repeat(indent);
    let yaml = '';

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;

      if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          if (typeof item === 'object') {
            yaml += `${spaces}- \n${toYAML(item, indent + 1)}`;
          } else {
            yaml += `${spaces}- ${item}\n`;
          }
        }
      } else if (typeof value === 'object') {
        yaml += `${spaces}${key}:\n${toYAML(value, indent + 1)}`;
      } else if (typeof value === 'string' && value.includes('\n')) {
        yaml += `${spaces}${key}: |\n`;
        value.split('\n').forEach(line => {
          yaml += `${spaces}  ${line}\n`;
        });
      } else {
        yaml += `${spaces}${key}: ${JSON.stringify(value)}\n`;
      }
    }

    return yaml;
  }

  return toYAML(spec);
}

// =============================================================================
// Exports
// =============================================================================

export { zodToOpenAPI };
export type { OpenAPISpec, RouterMeta, AIProcedureMeta };
