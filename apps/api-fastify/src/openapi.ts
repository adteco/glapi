import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { OpenAPIV3 } from 'openapi-types';
import {
  ontologyFieldTypeSchema,
  ontologyLifecycleStateSchema,
  ontologyOperationSchema,
  ontologyRecordCategorySchema,
  ontologyRecordStorageSchema,
  ontologyRelationshipTypeSchema,
} from '@glapi/types/ontology';
import { getPublicApiBaseUrl } from './config';

export function generateRuntimeOpenApiSpec(): OpenAPIV3.Document {
  const baseUrl = getPublicApiBaseUrl().replace(/\/$/, '');
  const spec = loadGeneratedOpenApiSpec();

  spec.servers = [
    {
      url: `${baseUrl}/api`,
      description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Runtime server',
    },
  ];

  addOntologyOpenApiSpec(spec);

  return spec;
}

function addOntologyOpenApiSpec(spec: OpenAPIV3.Document): void {
  spec.tags = [
    ...(spec.tags ?? []).filter((tag: { name?: string }) => tag.name !== 'Ontology'),
    {
      name: 'Ontology',
      description: 'API-first ERP ontology metadata for records, fields, operations, relationships, and events.',
    },
  ];

  spec.components ??= {};
  spec.components.schemas ??= {};
  Object.assign(spec.components.schemas, ontologySchemas());
  spec.paths ??= {};

  spec.paths['/api/ontology/version'] = {
    get: {
      tags: ['Ontology'],
      operationId: 'getOntologyVersion',
      summary: 'Get ontology version metadata',
      description: 'Returns the active ontology version and supported vocabulary.',
      responses: {
        '200': jsonResponse('Ontology metadata', 'OntologyMetadata'),
      },
    },
  };

  spec.paths['/api/ontology'] = {
    get: {
      tags: ['Ontology'],
      operationId: 'getOntologyRegistry',
      summary: 'Get the ontology registry',
      description: 'Returns the complete API-first ontology registry with standard record definitions.',
      responses: {
        '200': jsonResponse('Ontology registry', 'OntologyRegistryResponse'),
      },
    },
  };

  spec.paths['/api/ontology/records'] = {
    get: {
      tags: ['Ontology'],
      operationId: 'listOntologyRecords',
      summary: 'List ontology records',
      description: 'Lists ontology record definitions with optional filters for category, customization support, and operation support.',
      parameters: [
        {
          name: 'category',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            enum: ontologyRecordCategorySchema.options,
          },
        },
        {
          name: 'customizable',
          in: 'query',
          required: false,
          schema: {
            type: 'boolean',
          },
        },
        {
          name: 'operation',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            enum: ontologyOperationSchema.options,
          },
        },
      ],
      responses: {
        '200': jsonResponse('Ontology records', 'OntologyRecordsResponse'),
        '400': jsonResponse('Invalid ontology filter', 'ErrorResponse'),
      },
    },
  };

  spec.paths['/api/ontology/records/{key}'] = {
    get: {
      tags: ['Ontology'],
      operationId: 'getOntologyRecord',
      summary: 'Get an ontology record',
      description: 'Returns a single ontology record definition by stable record key.',
      parameters: [
        {
          name: 'key',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
          },
          example: 'business_transaction',
        },
      ],
      responses: {
        '200': jsonResponse('Ontology record', 'OntologyRecordResponse'),
        '404': jsonResponse('Ontology record not found', 'ErrorResponse'),
      },
    },
  };

  spec.paths['/api/ontology/events'] = {
    get: {
      tags: ['Ontology'],
      operationId: 'listOntologyEvents',
      summary: 'List ontology events',
      description: 'Lists all event names declared by ontology records.',
      responses: {
        '200': jsonResponse('Ontology events', 'OntologyEventsResponse'),
      },
    },
  };
}

function jsonResponse(description: string, schemaName: string) {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          $ref: `#/components/schemas/${schemaName}`,
        },
      },
    },
  };
}

function ontologySchemas() {
  return {
    OntologyMetadata: {
      type: 'object',
      required: ['version', 'recordCount', 'categories', 'fieldTypes', 'lifecycleStates', 'operations'],
      properties: {
        version: {
          type: 'string',
          pattern: '^\\d{4}\\.\\d{2}$',
          example: '2026.05',
        },
        recordCount: {
          type: 'integer',
          minimum: 0,
        },
        categories: {
          type: 'array',
          items: {
            type: 'string',
            enum: ontologyRecordCategorySchema.options,
          },
        },
        fieldTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ontologyFieldTypeSchema.options,
          },
        },
        lifecycleStates: {
          type: 'array',
          items: {
            type: 'string',
            enum: ontologyLifecycleStateSchema.options,
          },
        },
        operations: {
          type: 'array',
          items: {
            type: 'string',
            enum: ontologyOperationSchema.options,
          },
        },
      },
    },
    OntologyFieldDefinition: {
      type: 'object',
      required: [
        'key',
        'label',
        'type',
        'required',
        'readOnly',
        'searchable',
        'filterable',
        'sortable',
        'system',
      ],
      properties: {
        key: {
          type: 'string',
          pattern: '^[a-z][A-Za-z0-9]*$',
        },
        label: {
          type: 'string',
        },
        type: {
          type: 'string',
          enum: ontologyFieldTypeSchema.options,
        },
        description: {
          type: 'string',
        },
        required: {
          type: 'boolean',
        },
        readOnly: {
          type: 'boolean',
        },
        searchable: {
          type: 'boolean',
        },
        filterable: {
          type: 'boolean',
        },
        sortable: {
          type: 'boolean',
        },
        system: {
          type: 'boolean',
        },
        enumValues: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        referenceTo: {
          type: 'string',
          pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
        },
      },
    },
    OntologyRelationshipDefinition: {
      type: 'object',
      required: ['key', 'label', 'type', 'targetRecord'],
      properties: {
        key: {
          type: 'string',
          pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
        },
        label: {
          type: 'string',
        },
        type: {
          type: 'string',
          enum: ontologyRelationshipTypeSchema.options,
        },
        targetRecord: {
          type: 'string',
          pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
        },
        sourceField: {
          type: 'string',
          pattern: '^[a-z][A-Za-z0-9]*$',
        },
        targetField: {
          type: 'string',
          pattern: '^[a-z][A-Za-z0-9]*$',
        },
        description: {
          type: 'string',
        },
      },
    },
    OntologyRecordDefinition: {
      type: 'object',
      required: [
        'key',
        'label',
        'pluralLabel',
        'category',
        'storage',
        'description',
        'lifecycle',
        'ownedByPackage',
        'operations',
        'fields',
        'relationships',
        'events',
        'customizable',
      ],
      properties: {
        key: {
          type: 'string',
          pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
        },
        label: {
          type: 'string',
        },
        pluralLabel: {
          type: 'string',
        },
        category: {
          type: 'string',
          enum: ontologyRecordCategorySchema.options,
        },
        storage: {
          type: 'string',
          enum: ontologyRecordStorageSchema.options,
        },
        tableName: {
          type: 'string',
        },
        apiPath: {
          type: 'string',
          pattern: '^/api/[a-zA-Z0-9/_{}-]+$',
        },
        description: {
          type: 'string',
        },
        lifecycle: {
          type: 'string',
          enum: ontologyLifecycleStateSchema.options,
        },
        ownedByPackage: {
          type: 'string',
        },
        operations: {
          type: 'array',
          items: {
            type: 'string',
            enum: ontologyOperationSchema.options,
          },
        },
        fields: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/OntologyFieldDefinition',
          },
        },
        relationships: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/OntologyRelationshipDefinition',
          },
        },
        events: {
          type: 'array',
          items: {
            type: 'string',
            pattern: '^[a-z][A-Za-z0-9]*(?:\\.[a-z][A-Za-z0-9]*)+$',
          },
        },
        customizable: {
          type: 'boolean',
        },
        extensionOf: {
          type: 'string',
          pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
        },
      },
    },
    OntologyRegistryResponse: {
      allOf: [
        {
          $ref: '#/components/schemas/OntologyMetadata',
        },
        {
          type: 'object',
          required: ['records'],
          properties: {
            records: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/OntologyRecordDefinition',
              },
            },
          },
        },
      ],
    },
    OntologyRecordsResponse: {
      type: 'object',
      required: ['version', 'count', 'records'],
      properties: {
        version: {
          type: 'string',
        },
        count: {
          type: 'integer',
          minimum: 0,
        },
        records: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/OntologyRecordDefinition',
          },
        },
      },
    },
    OntologyRecordResponse: {
      type: 'object',
      required: ['version', 'record'],
      properties: {
        version: {
          type: 'string',
        },
        record: {
          $ref: '#/components/schemas/OntologyRecordDefinition',
        },
      },
    },
    OntologyEventDefinition: {
      type: 'object',
      required: ['name', 'recordKey', 'recordLabel', 'category'],
      properties: {
        name: {
          type: 'string',
          pattern: '^[a-z][A-Za-z0-9]*(?:\\.[a-z][A-Za-z0-9]*)+$',
        },
        recordKey: {
          type: 'string',
        },
        recordLabel: {
          type: 'string',
        },
        category: {
          type: 'string',
          enum: ontologyRecordCategorySchema.options,
        },
      },
    },
    OntologyEventsResponse: {
      type: 'object',
      required: ['version', 'count', 'events'],
      properties: {
        version: {
          type: 'string',
        },
        count: {
          type: 'integer',
          minimum: 0,
        },
        events: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/OntologyEventDefinition',
          },
        },
      },
    },
    ErrorResponse: {
      type: 'object',
      required: ['error'],
      properties: {
        error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: {
              type: 'string',
            },
            message: {
              type: 'string',
            },
          },
        },
      },
    },
  };
}

function loadGeneratedOpenApiSpec(): OpenAPIV3.Document {
  for (const candidate of getOpenApiCandidates()) {
    if (existsSync(candidate)) {
      return JSON.parse(readFileSync(candidate, 'utf8')) as OpenAPIV3.Document;
    }
  }

  throw new Error(
    `Generated OpenAPI spec not found. Run pnpm --filter @glapi/trpc generate:openapi before starting the Fastify API. Checked: ${getOpenApiCandidates().join(', ')}`
  );
}

function getOpenApiCandidates(): string[] {
  return [
    resolve(process.cwd(), 'apps/docs/public/api/openapi.json'),
    resolve(process.cwd(), '../docs/public/api/openapi.json'),
    resolve(process.cwd(), '../../apps/docs/public/api/openapi.json'),
    resolve(__dirname, '../../../apps/docs/public/api/openapi.json'),
  ];
}
