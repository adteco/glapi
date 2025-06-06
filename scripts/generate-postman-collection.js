#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Read the OpenAPI spec
const openApiPath = path.join(__dirname, '../docs/api-specs/glapi-master.openapi.yaml');
const openApiContent = fs.readFileSync(openApiPath, 'utf8');
const openApiSpec = yaml.load(openApiContent);

// Base Postman collection structure
const postmanCollection = {
  info: {
    name: openApiSpec.info.title,
    description: openApiSpec.info.description,
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  auth: {
    type: "apikey",
    apikey: [
      {
        key: "key",
        value: "{{api_key}}",
        type: "string"
      },
      {
        key: "value",
        value: "{{api_key_value}}",
        type: "string"
      },
      {
        key: "in",
        value: "header",
        type: "string"
      }
    ]
  },
  variable: [
    {
      key: "base_url",
      value: "http://localhost:3001/api/v1",
      type: "string"
    },
    {
      key: "api_key",
      value: "X-API-Key",
      type: "string"
    },
    {
      key: "api_key_value",
      value: "glapi_test_sk_1234567890abcdef",
      type: "string"
    }
  ],
  item: []
};

// Helper function to convert OpenAPI parameters to Postman
function convertParameters(parameters = []) {
  const query = [];
  const variable = [];

  parameters.forEach(param => {
    if (param.in === 'query') {
      query.push({
        key: param.name,
        value: param.schema?.default || '',
        description: param.description || ''
      });
    } else if (param.in === 'path') {
      variable.push({
        key: param.name,
        value: '',
        description: param.description || ''
      });
    }
  });

  return { query, variable };
}

// Helper function to create request body
function createRequestBody(requestBody) {
  if (!requestBody?.content?.['application/json']?.schema) return null;

  const schema = requestBody.content['application/json'].schema;
  let exampleBody = {};

  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop();
    const schemaDefinition = openApiSpec.components.schemas[refName];
    
    if (schemaDefinition?.properties) {
      Object.entries(schemaDefinition.properties).forEach(([key, prop]) => {
        if (prop.readOnly) return;
        
        if (prop.type === 'string') {
          if (prop.format === 'email') {
            exampleBody[key] = 'example@email.com';
          } else if (prop.format === 'uuid') {
            exampleBody[key] = '{{uuid}}';
          } else if (prop.enum) {
            exampleBody[key] = prop.enum[0];
          } else {
            exampleBody[key] = `Example ${key}`;
          }
        } else if (prop.type === 'integer') {
          exampleBody[key] = 1;
        } else if (prop.type === 'boolean') {
          exampleBody[key] = true;
        }
      });
    }
  }

  return {
    mode: 'raw',
    raw: JSON.stringify(exampleBody, null, 2),
    options: {
      raw: {
        language: 'json'
      }
    }
  };
}

// Group endpoints by tag
const folders = {};

// Process each path
Object.entries(openApiSpec.paths).forEach(([path, methods]) => {
  Object.entries(methods).forEach(([method, operation]) => {
    if (typeof operation !== 'object' || !operation.summary) return;

    const tag = operation.tags?.[0] || 'Other';
    
    if (!folders[tag]) {
      folders[tag] = {
        name: tag,
        item: []
      };
    }

    // Convert path parameters to Postman format
    const postmanPath = path.replace(/{([^}]+)}/g, ':$1');
    
    // Get parameters
    const { query, variable } = convertParameters(operation.parameters);

    // Create request
    const request = {
      name: operation.summary,
      request: {
        method: method.toUpperCase(),
        header: [
          {
            key: "Content-Type",
            value: "application/json",
            type: "text"
          },
          {
            key: "{{api_key}}",
            value: "{{api_key_value}}",
            type: "text"
          }
        ],
        url: {
          raw: `{{base_url}}${postmanPath}`,
          host: ["{{base_url}}"],
          path: postmanPath.split('/').filter(p => p),
          query: query.length > 0 ? query : undefined,
          variable: variable.length > 0 ? variable : undefined
        },
        description: operation.description || ''
      }
    };

    // Add request body if needed
    if (operation.requestBody) {
      request.request.body = createRequestBody(operation.requestBody);
    }

    // Add response examples
    if (operation.responses?.['200'] || operation.responses?.['201']) {
      const successResponse = operation.responses['200'] || operation.responses['201'];
      request.response = [{
        name: "Success Response",
        status: successResponse === operation.responses['201'] ? "Created" : "OK",
        code: successResponse === operation.responses['201'] ? 201 : 200,
        header: [
          {
            key: "Content-Type",
            value: "application/json"
          }
        ],
        body: "{\n  \"example\": \"response\"\n}"
      }];
    }

    folders[tag].item.push(request);
  });
});

// Add folders to collection
postmanCollection.item = Object.values(folders);

// Add a "Getting Started" folder with example requests
postmanCollection.item.unshift({
  name: "Getting Started",
  item: [
    {
      name: "Test Authentication",
      request: {
        method: "GET",
        header: [
          {
            key: "{{api_key}}",
            value: "{{api_key_value}}",
            type: "text"
          }
        ],
        url: {
          raw: "{{base_url}}/customers",
          host: ["{{base_url}}"],
          path: ["customers"]
        },
        description: "Test that your API key is working by fetching customers"
      }
    }
  ]
});

// Write the Postman collection
const outputPath = path.join(__dirname, '../apps/docs/public/api/postman-collection.json');
const outputDir = path.dirname(outputPath);

// Create directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(postmanCollection, null, 2));

console.log(`✅ Postman collection generated at: ${outputPath}`);
console.log(`📦 Collection includes ${Object.keys(folders).length} API groups`);
console.log(`🔑 Default API key: ${postmanCollection.variable.find(v => v.key === 'api_key_value').value}`);