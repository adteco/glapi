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

const monetaryValueSchema = {
  oneOf: [
    { type: 'number', minimum: 0 },
    { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
  ],
};

const dateSchema = {
  type: 'string',
  format: 'date',
};

const jsonObjectSchema = {
  type: 'object',
  additionalProperties: true,
};

const asc606Schemas: Record<string, any> = {
  Asc606SalesOrderLineInput: {
    type: 'object',
    required: ['description', 'quantity', 'unitPrice'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      itemId: { type: 'string', format: 'uuid' },
      description: { type: 'string', minLength: 1 },
      sku: { type: 'string' },
      quantity: {
        oneOf: [
          { type: 'number', minimum: 0, exclusiveMinimum: true },
          { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
        ],
      },
      unitOfMeasure: { type: 'string' },
      unitPrice: monetaryValueSchema,
      discountAmount: monetaryValueSchema,
      discountPercent: {
        oneOf: [
          { type: 'number', minimum: 0, maximum: 100 },
          { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
        ],
      },
      taxAmount: monetaryValueSchema,
      taxCode: { type: 'string' },
      requestedDeliveryDate: dateSchema,
      promisedDeliveryDate: dateSchema,
      departmentId: { type: 'string', format: 'uuid' },
      locationId: { type: 'string', format: 'uuid' },
      classId: { type: 'string', format: 'uuid' },
      projectId: { type: 'string', format: 'uuid' },
      revenueAccountId: { type: 'string', format: 'uuid' },
      deferredRevenueAccountId: { type: 'string', format: 'uuid' },
      revenueBehavior: { type: 'string', enum: ['point_in_time', 'over_time'] },
      sspAmount: monetaryValueSchema,
      listPrice: monetaryValueSchema,
      memo: { type: 'string' },
      metadata: jsonObjectSchema,
      _delete: { type: 'boolean' },
    },
  },
  Asc606SalesOrderInput: {
    type: 'object',
    required: ['subsidiaryId', 'entityId', 'orderDate', 'lines'],
    properties: {
      subsidiaryId: { type: 'string', format: 'uuid' },
      entityId: { type: 'string', format: 'uuid' },
      orderDate: dateSchema,
      externalReference: { type: 'string' },
      billingAddressId: { type: 'string', format: 'uuid' },
      shippingAddressId: { type: 'string', format: 'uuid' },
      requestedDeliveryDate: dateSchema,
      promisedDeliveryDate: dateSchema,
      expirationDate: dateSchema,
      currencyCode: { type: 'string', minLength: 3, maxLength: 3 },
      exchangeRate: {
        oneOf: [
          { type: 'number', minimum: 0, exclusiveMinimum: true },
          { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
        ],
      },
      discountAmount: monetaryValueSchema,
      discountPercent: {
        oneOf: [
          { type: 'number', minimum: 0, maximum: 100 },
          { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
        ],
      },
      shippingAmount: monetaryValueSchema,
      paymentTerms: { type: 'string' },
      shippingMethod: { type: 'string' },
      memo: { type: 'string' },
      internalNotes: { type: 'string' },
      metadata: jsonObjectSchema,
      requiresApproval: { type: 'boolean' },
      approvalThreshold: monetaryValueSchema,
      lines: {
        type: 'array',
        minItems: 1,
        items: { $ref: '#/components/schemas/Asc606SalesOrderLineInput' },
      },
    },
  },
  Asc606RevenuePlanConfig: {
    type: 'object',
    properties: {
      billingFrequency: {
        type: 'string',
        enum: ['monthly', 'quarterly', 'annual'],
        default: 'monthly',
      },
      termMonths: {
        type: 'integer',
        minimum: 1,
        maximum: 120,
        default: 12,
      },
      autoActivateSubscription: { type: 'boolean', default: true },
      contractStartDate: dateSchema,
      contractEndDate: dateSchema,
      recognitionEffectiveDate: dateSchema,
    },
  },
  Asc606CreateSalesOrderPlanRequest: {
    type: 'object',
    required: ['order'],
    properties: {
      order: { $ref: '#/components/schemas/Asc606SalesOrderInput' },
      revenuePlan: { $ref: '#/components/schemas/Asc606RevenuePlanConfig' },
    },
  },
  Asc606GenerateSalesOrderPlanRequest: {
    type: 'object',
    properties: {
      revenuePlan: { $ref: '#/components/schemas/Asc606RevenuePlanConfig' },
    },
  },
  Asc606LicenseChangeRequest: {
    type: 'object',
    required: ['itemId', 'action', 'quantity', 'effectiveDate'],
    properties: {
      itemId: { type: 'string', format: 'uuid' },
      action: { type: 'string', enum: ['add', 'remove'] },
      quantity: { type: 'number', minimum: 0, exclusiveMinimum: true },
      unitPrice: { type: 'number', minimum: 0, exclusiveMinimum: true },
      effectiveDate: dateSchema,
      endDate: dateSchema,
      reason: { type: 'string' },
    },
  },
  Asc606SubscriptionPlan: {
    type: 'object',
    properties: {
      subscription: jsonObjectSchema,
      summary: {
        type: 'object',
        properties: {
          totalScheduled: { type: 'number' },
          totalRecognized: { type: 'number' },
          totalDeferred: { type: 'number' },
        },
      },
      obligations: {
        type: 'array',
        items: { type: 'object', additionalProperties: true },
      },
      allocations: {
        type: 'array',
        items: { type: 'object', additionalProperties: true },
      },
      invoiceSchedule: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            invoiceDate: dateSchema,
            amount: { type: 'number' },
          },
        },
      },
      schedules: {
        type: 'array',
        items: { type: 'object', additionalProperties: true },
      },
      waterfall: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            period: { type: 'string', example: '2026-01' },
            scheduled: { type: 'number' },
            recognized: { type: 'number' },
            deferredBalance: { type: 'number' },
          },
        },
      },
    },
  },
  Asc606SalesOrderPlanResponse: {
    type: 'object',
    properties: {
      order: jsonObjectSchema,
      subscription: jsonObjectSchema,
      calculation: jsonObjectSchema,
      plan: { $ref: '#/components/schemas/Asc606SubscriptionPlan' },
    },
  },
  Asc606LicenseChangePreviewResponse: {
    type: 'object',
    properties: {
      baseline: jsonObjectSchema,
      scenario: jsonObjectSchema,
      delta: {
        type: 'object',
        properties: {
          transactionPrice: { type: 'number' },
        },
      },
    },
  },
  Asc606LicenseChangeApplyResponse: {
    type: 'object',
    properties: {
      subscription: jsonObjectSchema,
      calculation: jsonObjectSchema,
      plan: { $ref: '#/components/schemas/Asc606SubscriptionPlan' },
    },
  },
  ErrorResponse: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      code: { type: 'string' },
      details: {},
    },
  },
};

function schemaRef(name: keyof typeof asc606Schemas): Record<string, string> {
  return { $ref: `#/components/schemas/${name}` };
}

function jsonContent(schema: any): Record<string, any> {
  return {
    'application/json': {
      schema,
    },
  };
}

function successResponse(description: string, schema: any): Record<string, any> {
  return {
    description,
    content: jsonContent(schema),
  };
}

function errorResponses(): Record<string, any> {
  return {
    '400': successResponse('Bad request', schemaRef('ErrorResponse')),
    '401': successResponse('Unauthorized - Invalid or missing authentication', schemaRef('ErrorResponse')),
    '403': successResponse('Forbidden', schemaRef('ErrorResponse')),
    '404': successResponse('Resource not found', schemaRef('ErrorResponse')),
    '500': successResponse('Internal server error', schemaRef('ErrorResponse')),
  };
}

function uuidPathParameter(name: string, description: string): Record<string, any> {
  return {
    name,
    in: 'path',
    required: true,
    schema: {
      type: 'string',
      format: 'uuid',
    },
    description,
  };
}

function asc606ContextHeaders(): Array<Record<string, any>> {
  return [
    {
      name: 'x-organization-id',
      in: 'header',
      required: false,
      schema: { type: 'string', format: 'uuid' },
      description: 'Organization context for the request. API keys may also provide this context.',
    },
    {
      name: 'x-user-id',
      in: 'header',
      required: false,
      schema: { type: 'string' },
      description: 'Actor ID used for audit attribution on server-to-server requests.',
    },
  ];
}

function addRequestBody(operationSpec: Record<string, any>, schema: any): void {
  operationSpec.requestBody = {
    required: true,
    content: jsonContent(schema),
  };
}

function addAsc606RevenuePaths(spec: OpenAPISpec): void {
  Object.assign(spec.components.schemas, asc606Schemas);

  const tag = 'Revenue ASC 606';
  const baseParameters = asc606ContextHeaders();

  const operations: Array<{
    path: string;
    method: 'get' | 'post';
    operation: Record<string, any>;
    requestSchema?: any;
  }> = [
    {
      path: '/api/revenue/asc606/sales-orders',
      method: 'post',
      operation: {
        summary: 'Create sales order and generate ASC 606 plan',
        description: 'Creates a sales order and immediately returns generated ASC 606 obligations, schedules, and waterfall output.',
        tags: [tag],
        operationId: 'createSalesOrderRevenuePlan',
        parameters: baseParameters,
        responses: {
          '201': successResponse('Sales order and ASC 606 plan created', schemaRef('Asc606SalesOrderPlanResponse')),
          ...errorResponses(),
        },
      },
      requestSchema: schemaRef('Asc606CreateSalesOrderPlanRequest'),
    },
    {
      path: '/api/revenue/asc606/sales-orders/{salesOrderId}/plan',
      method: 'post',
      operation: {
        summary: 'Generate ASC 606 plan for an existing sales order',
        description: 'Generates or regenerates ASC 606 plan outputs for an existing sales order.',
        tags: [tag],
        operationId: 'generateSalesOrderRevenuePlan',
        parameters: [
          uuidPathParameter('salesOrderId', 'Sales order ID'),
          ...baseParameters,
        ],
        responses: {
          '200': successResponse('ASC 606 plan generated', schemaRef('Asc606SalesOrderPlanResponse')),
          ...errorResponses(),
        },
      },
      requestSchema: schemaRef('Asc606GenerateSalesOrderPlanRequest'),
    },
    {
      path: '/api/revenue/asc606/subscriptions/{subscriptionId}/plan',
      method: 'get',
      operation: {
        summary: 'Get ASC 606 subscription plan',
        description: 'Returns subscription-level ASC 606 summary, obligations, allocations, schedules, invoice schedule, and waterfall output.',
        tags: [tag],
        operationId: 'getSubscriptionRevenuePlan',
        parameters: [
          uuidPathParameter('subscriptionId', 'Subscription ID'),
          ...baseParameters,
          {
            name: 'startDate',
            in: 'query',
            required: false,
            schema: dateSchema,
            description: 'Inclusive schedule period start date filter.',
          },
          {
            name: 'endDate',
            in: 'query',
            required: false,
            schema: dateSchema,
            description: 'Inclusive schedule period end date filter.',
          },
        ],
        responses: {
          '200': successResponse('ASC 606 subscription plan', schemaRef('Asc606SubscriptionPlan')),
          ...errorResponses(),
        },
      },
    },
    {
      path: '/api/revenue/asc606/subscriptions/{subscriptionId}/license-changes/preview',
      method: 'post',
      operation: {
        summary: 'Preview ASC 606 license change impact',
        description: 'Returns what-if ASC 606 allocation impact for a software license add/remove change without persisting the amendment.',
        tags: [tag],
        operationId: 'previewLicenseChange',
        parameters: [
          uuidPathParameter('subscriptionId', 'Subscription ID'),
          ...baseParameters,
        ],
        responses: {
          '200': successResponse('License change preview', schemaRef('Asc606LicenseChangePreviewResponse')),
          ...errorResponses(),
        },
      },
      requestSchema: schemaRef('Asc606LicenseChangeRequest'),
    },
    {
      path: '/api/revenue/asc606/subscriptions/{subscriptionId}/license-changes/apply',
      method: 'post',
      operation: {
        summary: 'Apply ASC 606 license change',
        description: 'Persists a software license add/remove amendment and returns recalculated ASC 606 outputs.',
        tags: [tag],
        operationId: 'applyLicenseChange',
        parameters: [
          uuidPathParameter('subscriptionId', 'Subscription ID'),
          ...baseParameters,
        ],
        responses: {
          '200': successResponse('License change applied', schemaRef('Asc606LicenseChangeApplyResponse')),
          ...errorResponses(),
        },
      },
      requestSchema: schemaRef('Asc606LicenseChangeRequest'),
    },
  ];

  for (const { path, method, operation, requestSchema } of operations) {
    spec.paths[path] ??= {};
    if (requestSchema) {
      addRequestBody(operation, requestSchema);
    }
    spec.paths[path][method] = operation;
  }
}

export interface GenerateOpenAPIOptions {
  /** Include x-ai-* extensions for AI tooling (default: true) */
  includeAIExtensions?: boolean;
  /** Use default AI metadata for procedures without explicit meta (default: true) */
  useDefaultAIMeta?: boolean;
  /** Custom AI metadata overrides by operationId */
  aiMetaOverrides?: Record<string, AIProcedureMeta>;
  /** Override generated server URLs for the runtime serving the spec */
  servers?: Array<{ url: string; description: string }>;
}

/**
 * Generate OpenAPI specification from tRPC router
 */
export function generateOpenAPISpec(options: GenerateOpenAPIOptions = {}): OpenAPISpec {
  const {
    includeAIExtensions = true,
    useDefaultAIMeta = true,
    aiMetaOverrides = {},
    servers,
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
- Staging: https://staging-api.glapi.net/api
- Production: https://api.glapi.net/api
      `.trim(),
    },
    servers: servers ?? [
      {
        url: 'http://localhost:3031/api',
        description: 'Development server',
      },
      {
        url: 'https://staging-api.glapi.net/api',
        description: 'Staging server',
      },
      {
        url: 'https://api.glapi.net/api',
        description: 'Production server',
      },
    ],
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {
        BetterAuthSession: {
          type: 'apiKey',
          in: 'cookie',
          name: 'better-auth.session_token',
          description:
            'Better Auth session cookie issued by /api/auth endpoints for browser clients.',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'GLAPI API key for server-to-server and SDK clients.',
        },
      },
    },
    security: [{ BetterAuthSession: [] }, { ApiKeyAuth: [] }],
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

  addAsc606RevenuePaths(spec);

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
