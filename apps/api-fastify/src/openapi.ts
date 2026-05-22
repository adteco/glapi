import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { OpenAPIV3 } from 'openapi-types';
import {
  customFieldLifecycleSchema,
  customFieldPlacementSchema,
} from '@glapi/types/custom-fields';
import {
  ontologyFieldTypeSchema,
  ontologyLifecycleStateSchema,
  ontologyOperationSchema,
  ontologyRecordCategorySchema,
  ontologyRecordStorageSchema,
  ontologyRelationshipTypeSchema,
} from '@glapi/types/ontology';
import {
  savedSearchAggregateSchema,
  savedSearchExecutionModeSchema,
  savedSearchFormulaTypeSchema,
  savedSearchOperatorSchema,
  savedSearchSortDirectionSchema,
  savedSearchVisibilitySchema,
} from '@glapi/types/saved-searches';
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
  addSavedSearchOpenApiSpec(spec);
  addCustomFieldOpenApiSpec(spec);

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

function addSavedSearchOpenApiSpec(spec: OpenAPIV3.Document): void {
  spec.tags = [
    ...(spec.tags ?? []).filter((tag: { name?: string }) => tag.name !== 'Saved Searches'),
    {
      name: 'Saved Searches',
      description: 'Ontology-backed saved searches for lists, reports, exports, APIs, and automation.',
    },
  ];

  spec.components ??= {};
  spec.components.schemas ??= {};
  Object.assign(spec.components.schemas, savedSearchSchemas());
  spec.paths ??= {};

  spec.paths['/api/saved-searches'] = {
    get: {
      tags: ['Saved Searches'],
      operationId: 'listSavedSearches',
      summary: 'List saved searches',
      parameters: [
        {
          name: 'recordKey',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
          },
        },
        {
          name: 'visibility',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            enum: savedSearchVisibilitySchema.options,
          },
        },
      ],
      responses: {
        '200': jsonResponse('Saved searches', 'SavedSearchListResponse'),
      },
    },
    post: {
      tags: ['Saved Searches'],
      operationId: 'createSavedSearch',
      summary: 'Create a saved search',
      requestBody: jsonRequest('CreateSavedSearchRequest'),
      responses: {
        '201': jsonResponse('Saved search created', 'SavedSearchResponse'),
        '400': jsonResponse('Invalid saved search payload', 'ErrorResponse'),
        '422': jsonResponse('Saved search validation failed', 'ErrorResponse'),
      },
    },
  };

  spec.paths['/api/saved-searches/validate'] = {
    post: {
      tags: ['Saved Searches'],
      operationId: 'validateSavedSearch',
      summary: 'Validate a saved search definition',
      requestBody: jsonRequest('SavedSearchDefinition'),
      responses: {
        '200': jsonResponse('Saved search validation result', 'SavedSearchValidationResult'),
      },
    },
  };

  spec.paths['/api/saved-searches/run'] = {
    post: {
      tags: ['Saved Searches'],
      operationId: 'runAdHocSavedSearch',
      summary: 'Run an ad hoc saved search definition',
      description: 'Validates and compiles an ad hoc definition into a query plan. Database execution is a later persistence/execution step.',
      requestBody: jsonRequest('RunSavedSearchRequest'),
      responses: {
        '200': jsonResponse('Saved search run result', 'SavedSearchRunResult'),
        '400': jsonResponse('Invalid run payload', 'ErrorResponse'),
        '422': jsonResponse('Saved search validation failed', 'ErrorResponse'),
      },
    },
  };

  spec.paths['/api/saved-searches/{id}'] = {
    get: {
      tags: ['Saved Searches'],
      operationId: 'getSavedSearch',
      summary: 'Get a saved search',
      parameters: [pathIdParameter()],
      responses: {
        '200': jsonResponse('Saved search', 'SavedSearchResponse'),
        '404': jsonResponse('Saved search not found', 'ErrorResponse'),
      },
    },
    put: {
      tags: ['Saved Searches'],
      operationId: 'updateSavedSearch',
      summary: 'Update a saved search',
      parameters: [pathIdParameter()],
      requestBody: jsonRequest('UpdateSavedSearchRequest'),
      responses: {
        '200': jsonResponse('Saved search updated', 'SavedSearchResponse'),
        '400': jsonResponse('Invalid saved search payload', 'ErrorResponse'),
        '403': jsonResponse('Saved search update forbidden', 'ErrorResponse'),
        '404': jsonResponse('Saved search not found', 'ErrorResponse'),
        '422': jsonResponse('Saved search validation failed', 'ErrorResponse'),
      },
    },
    delete: {
      tags: ['Saved Searches'],
      operationId: 'deleteSavedSearch',
      summary: 'Delete a saved search',
      parameters: [pathIdParameter()],
      responses: {
        '204': {
          description: 'Saved search deleted',
        },
        '403': jsonResponse('Saved search delete forbidden', 'ErrorResponse'),
        '404': jsonResponse('Saved search not found', 'ErrorResponse'),
      },
    },
  };

  spec.paths['/api/saved-searches/{id}/run'] = {
    post: {
      tags: ['Saved Searches'],
      operationId: 'runSavedSearch',
      summary: 'Run a saved search',
      description: 'Compiles the saved search into a query plan. Database-backed row execution is a later persistence/execution step.',
      parameters: [pathIdParameter()],
      requestBody: jsonRequest('RunSavedSearchRequest'),
      responses: {
        '200': jsonResponse('Saved search run result', 'SavedSearchRunResult'),
        '400': jsonResponse('Invalid run payload', 'ErrorResponse'),
        '404': jsonResponse('Saved search not found', 'ErrorResponse'),
      },
    },
  };
}

function addCustomFieldOpenApiSpec(spec: OpenAPIV3.Document): void {
  spec.tags = [
    ...(spec.tags ?? []).filter((tag: { name?: string }) => tag.name !== 'Custom Fields'),
    {
      name: 'Custom Fields',
      description: 'Ontology-backed custom field definitions and customFields payload validation.',
    },
  ];

  spec.components ??= {};
  spec.components.schemas ??= {};
  Object.assign(spec.components.schemas, customFieldSchemas());
  spec.paths ??= {};

  spec.paths['/api/custom-field-definitions'] = {
    get: {
      tags: ['Custom Fields'],
      operationId: 'listCustomFieldDefinitions',
      summary: 'List custom field definitions',
      parameters: [
        {
          name: 'recordKey',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
          },
        },
        {
          name: 'lifecycle',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            enum: customFieldLifecycleSchema.options,
          },
        },
      ],
      responses: {
        '200': jsonResponse('Custom field definitions', 'CustomFieldDefinitionListResponse'),
      },
    },
    post: {
      tags: ['Custom Fields'],
      operationId: 'createCustomFieldDefinition',
      summary: 'Create a custom field definition',
      requestBody: jsonRequest('CreateCustomFieldDefinitionRequest'),
      responses: {
        '201': jsonResponse('Custom field definition created', 'CustomFieldDefinitionResponse'),
        '400': jsonResponse('Invalid custom field definition payload', 'ErrorResponse'),
        '403': jsonResponse('Custom field write forbidden', 'ErrorResponse'),
        '422': jsonResponse('Custom field definition validation failed', 'ErrorResponse'),
      },
    },
  };

  spec.paths['/api/custom-field-definitions/validate'] = {
    post: {
      tags: ['Custom Fields'],
      operationId: 'validateCustomFieldDefinition',
      summary: 'Validate a custom field definition',
      requestBody: jsonRequest('CreateCustomFieldDefinitionRequest'),
      responses: {
        '200': jsonResponse('Custom field definition validation result', 'CustomFieldValidationResult'),
      },
    },
  };

  spec.paths['/api/custom-field-definitions/validate-values'] = {
    post: {
      tags: ['Custom Fields'],
      operationId: 'validateCustomFieldValues',
      summary: 'Validate customFields values for a record',
      requestBody: jsonRequest('CustomFieldValuesValidationRequest'),
      responses: {
        '200': jsonResponse('Custom field values validation result', 'CustomFieldValuesValidationResult'),
        '400': jsonResponse('Invalid custom field values payload', 'ErrorResponse'),
      },
    },
  };

  spec.paths['/api/custom-field-definitions/{id}'] = {
    get: {
      tags: ['Custom Fields'],
      operationId: 'getCustomFieldDefinition',
      summary: 'Get a custom field definition',
      parameters: [pathIdParameter()],
      responses: {
        '200': jsonResponse('Custom field definition', 'CustomFieldDefinitionResponse'),
        '404': jsonResponse('Custom field definition not found', 'ErrorResponse'),
      },
    },
    put: {
      tags: ['Custom Fields'],
      operationId: 'updateCustomFieldDefinition',
      summary: 'Update a custom field definition',
      parameters: [pathIdParameter()],
      requestBody: jsonRequest('UpdateCustomFieldDefinitionRequest'),
      responses: {
        '200': jsonResponse('Custom field definition updated', 'CustomFieldDefinitionResponse'),
        '400': jsonResponse('Invalid custom field definition payload', 'ErrorResponse'),
        '403': jsonResponse('Custom field update forbidden', 'ErrorResponse'),
        '404': jsonResponse('Custom field definition not found', 'ErrorResponse'),
        '422': jsonResponse('Custom field definition validation failed', 'ErrorResponse'),
      },
    },
    delete: {
      tags: ['Custom Fields'],
      operationId: 'deleteCustomFieldDefinition',
      summary: 'Delete a custom field definition',
      parameters: [pathIdParameter()],
      responses: {
        '204': {
          description: 'Custom field definition deleted',
        },
        '403': jsonResponse('Custom field delete forbidden', 'ErrorResponse'),
        '404': jsonResponse('Custom field definition not found', 'ErrorResponse'),
      },
    },
  };
}

function jsonRequest(schemaName: string) {
  return {
    required: true,
    content: {
      'application/json': {
        schema: {
          $ref: `#/components/schemas/${schemaName}`,
        },
      },
    },
  };
}

function pathIdParameter(): OpenAPIV3.ParameterObject {
  return {
    name: 'id',
    in: 'path',
    required: true,
    schema: {
      type: 'string',
      format: 'uuid',
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

function savedSearchSchemas() {
  return {
    SavedSearchFormula: {
      type: 'object',
      required: ['key', 'label', 'type', 'expression'],
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
          enum: savedSearchFormulaTypeSchema.options,
        },
        expression: {
          type: 'string',
          maxLength: 500,
          description: 'Restricted formula expression. Raw SQL is not accepted.',
        },
      },
    },
    SavedSearchColumn: {
      type: 'object',
      properties: {
        fieldKey: {
          type: 'string',
          pattern: '^[a-z][A-Za-z0-9]*$',
        },
        relationshipKey: {
          type: 'string',
          pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
        },
        label: {
          type: 'string',
        },
        aggregate: {
          type: 'string',
          enum: savedSearchAggregateSchema.options,
        },
        formula: {
          $ref: '#/components/schemas/SavedSearchFormula',
        },
      },
    },
    SavedSearchFilter: {
      type: 'object',
      required: ['fieldKey', 'operator'],
      properties: {
        fieldKey: {
          type: 'string',
          pattern: '^[a-z][A-Za-z0-9]*$',
        },
        relationshipKey: {
          type: 'string',
          pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
        },
        operator: {
          type: 'string',
          enum: savedSearchOperatorSchema.options,
        },
        value: {},
        parameterKey: {
          type: 'string',
          pattern: '^[a-z][A-Za-z0-9]*$',
        },
      },
    },
    SavedSearchSort: {
      type: 'object',
      required: ['fieldKey'],
      properties: {
        fieldKey: {
          type: 'string',
          pattern: '^[a-z][A-Za-z0-9]*$',
        },
        relationshipKey: {
          type: 'string',
          pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
        },
        direction: {
          type: 'string',
          enum: savedSearchSortDirectionSchema.options,
          default: 'asc',
        },
      },
    },
    SavedSearchJoin: {
      type: 'object',
      required: ['relationshipKey'],
      properties: {
        relationshipKey: {
          type: 'string',
          pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
        },
        alias: {
          type: 'string',
          pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
        },
        required: {
          type: 'boolean',
          default: false,
        },
      },
    },
    SavedSearchDefinition: {
      type: 'object',
      required: ['recordKey', 'columns'],
      properties: {
        recordKey: {
          type: 'string',
          pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
        },
        columns: {
          type: 'array',
          minItems: 1,
          items: {
            $ref: '#/components/schemas/SavedSearchColumn',
          },
        },
        filters: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/SavedSearchFilter',
          },
        },
        joins: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/SavedSearchJoin',
          },
        },
        sort: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/SavedSearchSort',
          },
        },
        groupBy: {
          type: 'array',
          items: {
            type: 'string',
            pattern: '^[a-z][A-Za-z0-9]*$',
          },
        },
        pageSize: {
          type: 'integer',
          minimum: 1,
          maximum: 1000,
          default: 100,
        },
      },
    },
    SavedSearch: {
      type: 'object',
      required: [
        'id',
        'organizationId',
        'name',
        'visibility',
        'definition',
        'createdBy',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
        },
        organizationId: {
          type: 'string',
        },
        name: {
          type: 'string',
        },
        description: {
          type: 'string',
        },
        visibility: {
          type: 'string',
          enum: savedSearchVisibilitySchema.options,
        },
        definition: {
          $ref: '#/components/schemas/SavedSearchDefinition',
        },
        createdBy: {
          type: 'string',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
        },
      },
    },
    CreateSavedSearchRequest: {
      type: 'object',
      required: ['name', 'definition'],
      properties: {
        name: {
          type: 'string',
        },
        description: {
          type: 'string',
        },
        visibility: {
          type: 'string',
          enum: savedSearchVisibilitySchema.options,
          default: 'private',
        },
        definition: {
          $ref: '#/components/schemas/SavedSearchDefinition',
        },
      },
    },
    UpdateSavedSearchRequest: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
        },
        description: {
          type: 'string',
        },
        visibility: {
          type: 'string',
          enum: savedSearchVisibilitySchema.options,
        },
        definition: {
          $ref: '#/components/schemas/SavedSearchDefinition',
        },
      },
    },
    SavedSearchResponse: {
      type: 'object',
      required: ['savedSearch'],
      properties: {
        savedSearch: {
          $ref: '#/components/schemas/SavedSearch',
        },
      },
    },
    SavedSearchListResponse: {
      type: 'object',
      required: ['count', 'savedSearches'],
      properties: {
        count: {
          type: 'integer',
          minimum: 0,
        },
        savedSearches: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/SavedSearch',
          },
        },
      },
    },
    SavedSearchValidationIssue: {
      type: 'object',
      required: ['code', 'message', 'path'],
      properties: {
        code: {
          type: 'string',
        },
        message: {
          type: 'string',
        },
        path: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    },
    SavedSearchValidationResult: {
      type: 'object',
      required: ['valid', 'issues'],
      properties: {
        valid: {
          type: 'boolean',
        },
        issues: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/SavedSearchValidationIssue',
          },
        },
      },
    },
    SavedSearchQueryPlan: {
      type: 'object',
      required: ['recordKey', 'recordLabel', 'columns', 'filters', 'joins', 'sort', 'groupBy', 'pageSize'],
      properties: {
        recordKey: {
          type: 'string',
        },
        recordLabel: {
          type: 'string',
        },
        columns: {
          type: 'array',
          items: {
            type: 'object',
          },
        },
        filters: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/SavedSearchFilter',
          },
        },
        joins: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/SavedSearchJoin',
          },
        },
        sort: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/SavedSearchSort',
          },
        },
        groupBy: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        pageSize: {
          type: 'integer',
          minimum: 1,
          maximum: 1000,
        },
      },
    },
    RunSavedSearchRequest: {
      type: 'object',
      properties: {
        definition: {
          $ref: '#/components/schemas/SavedSearchDefinition',
        },
        parameters: {
          type: 'object',
          additionalProperties: true,
        },
        page: {
          type: 'integer',
          minimum: 1,
          default: 1,
        },
        pageSize: {
          type: 'integer',
          minimum: 1,
          maximum: 1000,
        },
      },
    },
    SavedSearchRunResult: {
      type: 'object',
      required: ['executionMode', 'plan', 'rows', 'page', 'pageSize'],
      properties: {
        executionMode: {
          type: 'string',
          enum: savedSearchExecutionModeSchema.options,
        },
        plan: {
          $ref: '#/components/schemas/SavedSearchQueryPlan',
        },
        rows: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true,
          },
        },
        page: {
          type: 'integer',
          minimum: 1,
        },
        pageSize: {
          type: 'integer',
          minimum: 1,
          maximum: 1000,
        },
        totalRows: {
          type: 'integer',
          minimum: 0,
        },
      },
    },
  };
}

function customFieldSchemas() {
  return {
    CustomFieldValidationRule: {
      type: 'object',
      properties: {
        min: { type: 'number' },
        max: { type: 'number' },
        minLength: { type: 'integer', minimum: 0 },
        maxLength: { type: 'integer', minimum: 0 },
        regex: { type: 'string' },
        enumValues: {
          type: 'array',
          items: { type: 'string' },
        },
        precision: { type: 'integer', minimum: 0 },
        scale: { type: 'integer', minimum: 0 },
      },
    },
    CustomFieldPermission: {
      type: 'object',
      properties: {
        readRoles: {
          type: 'array',
          items: { type: 'string' },
          default: [],
        },
        writeRoles: {
          type: 'array',
          items: { type: 'string' },
          default: [],
        },
      },
    },
    CustomFieldUi: {
      type: 'object',
      properties: {
        section: { type: 'string' },
        helpText: { type: 'string' },
        placeholder: { type: 'string' },
        displayOrder: {
          type: 'integer',
          default: 0,
        },
      },
    },
    CustomFieldDefinition: {
      type: 'object',
      required: [
        'id',
        'organizationId',
        'recordKey',
        'fieldKey',
        'label',
        'type',
        'lifecycle',
        'placement',
        'required',
        'readOnly',
        'searchable',
        'filterable',
        'sortable',
        'visibleInApi',
        'validation',
        'permissions',
        'ui',
        'createdBy',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        id: { type: 'string', format: 'uuid' },
        organizationId: { type: 'string' },
        recordKey: {
          type: 'string',
          pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
        },
        fieldKey: {
          type: 'string',
          pattern: '^[a-z][A-Za-z0-9]*$',
        },
        label: { type: 'string', maxLength: 120 },
        description: { type: 'string', maxLength: 1000 },
        type: {
          type: 'string',
          enum: ontologyFieldTypeSchema.options,
        },
        lifecycle: {
          type: 'string',
          enum: customFieldLifecycleSchema.options,
        },
        placement: {
          type: 'string',
          enum: customFieldPlacementSchema.options,
        },
        required: { type: 'boolean' },
        readOnly: { type: 'boolean' },
        defaultValue: {},
        searchable: { type: 'boolean' },
        filterable: { type: 'boolean' },
        sortable: { type: 'boolean' },
        visibleInApi: { type: 'boolean' },
        referenceTo: {
          type: 'string',
          pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
        },
        validation: {
          $ref: '#/components/schemas/CustomFieldValidationRule',
        },
        permissions: {
          $ref: '#/components/schemas/CustomFieldPermission',
        },
        ui: {
          $ref: '#/components/schemas/CustomFieldUi',
        },
        createdBy: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
    CreateCustomFieldDefinitionRequest: {
      type: 'object',
      required: ['recordKey', 'fieldKey', 'label', 'type'],
      properties: {
        recordKey: {
          type: 'string',
          pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
        },
        fieldKey: {
          type: 'string',
          pattern: '^[a-z][A-Za-z0-9]*$',
        },
        label: { type: 'string', maxLength: 120 },
        description: { type: 'string', maxLength: 1000 },
        type: {
          type: 'string',
          enum: ontologyFieldTypeSchema.options,
        },
        lifecycle: {
          type: 'string',
          enum: customFieldLifecycleSchema.options,
          default: 'active',
        },
        placement: {
          type: 'string',
          enum: customFieldPlacementSchema.options,
          default: 'body',
        },
        required: { type: 'boolean', default: false },
        readOnly: { type: 'boolean', default: false },
        defaultValue: {},
        searchable: { type: 'boolean', default: false },
        filterable: { type: 'boolean', default: false },
        sortable: { type: 'boolean', default: false },
        visibleInApi: { type: 'boolean', default: true },
        referenceTo: {
          type: 'string',
          pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
        },
        validation: {
          $ref: '#/components/schemas/CustomFieldValidationRule',
        },
        permissions: {
          $ref: '#/components/schemas/CustomFieldPermission',
        },
        ui: {
          $ref: '#/components/schemas/CustomFieldUi',
        },
      },
    },
    UpdateCustomFieldDefinitionRequest: {
      type: 'object',
      properties: {
        label: { type: 'string', maxLength: 120 },
        description: { type: 'string', maxLength: 1000 },
        lifecycle: {
          type: 'string',
          enum: customFieldLifecycleSchema.options,
        },
        required: { type: 'boolean' },
        readOnly: { type: 'boolean' },
        defaultValue: {},
        searchable: { type: 'boolean' },
        filterable: { type: 'boolean' },
        sortable: { type: 'boolean' },
        visibleInApi: { type: 'boolean' },
        validation: {
          $ref: '#/components/schemas/CustomFieldValidationRule',
        },
        permissions: {
          $ref: '#/components/schemas/CustomFieldPermission',
        },
        ui: {
          $ref: '#/components/schemas/CustomFieldUi',
        },
      },
    },
    CustomFieldDefinitionResponse: {
      type: 'object',
      required: ['customFieldDefinition'],
      properties: {
        customFieldDefinition: {
          $ref: '#/components/schemas/CustomFieldDefinition',
        },
      },
    },
    CustomFieldDefinitionListResponse: {
      type: 'object',
      required: ['count', 'customFieldDefinitions'],
      properties: {
        count: { type: 'integer', minimum: 0 },
        customFieldDefinitions: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/CustomFieldDefinition',
          },
        },
      },
    },
    CustomFieldValidationIssue: {
      type: 'object',
      required: ['code', 'message', 'path'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        path: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
    CustomFieldValidationResult: {
      type: 'object',
      required: ['valid', 'issues'],
      properties: {
        valid: { type: 'boolean' },
        issues: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/CustomFieldValidationIssue',
          },
        },
      },
    },
    CustomFieldValuesValidationRequest: {
      type: 'object',
      required: ['recordKey', 'values'],
      properties: {
        recordKey: {
          type: 'string',
          pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$',
        },
        values: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    CustomFieldValuesValidationResult: {
      type: 'object',
      required: ['valid', 'issues', 'normalizedValues'],
      properties: {
        valid: { type: 'boolean' },
        issues: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/CustomFieldValidationIssue',
          },
        },
        normalizedValues: {
          type: 'object',
          additionalProperties: true,
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
