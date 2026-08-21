import { describe, expect, it } from 'vitest';
import { generateRuntimeOpenApiSpec } from '../openapi';

describe('runtime OpenAPI spec', () => {
  it('documents ontology endpoints and schemas', () => {
    const spec = generateRuntimeOpenApiSpec();

    expect(spec.paths?.['/v1/ontology']).toBeDefined();
    expect(spec.paths?.['/v1/ontology/records']).toBeDefined();
    expect(spec.paths?.['/v1/ontology/records/{key}']).toBeDefined();
    expect(spec.paths?.['/v1/ontology/events']).toBeDefined();
    expect(spec.components?.schemas?.OntologyRecordDefinition).toBeDefined();
    expect(spec.components?.schemas?.OntologyEventsResponse).toBeDefined();
  });

  it('documents saved search endpoints and schemas', () => {
    const spec = generateRuntimeOpenApiSpec();

    expect(spec.paths?.['/v1/saved-searches']).toBeDefined();
    expect(spec.paths?.['/v1/saved-searches/validate']).toBeDefined();
    expect(spec.paths?.['/v1/saved-searches/run']).toBeDefined();
    expect(spec.paths?.['/v1/saved-searches/{id}']).toBeDefined();
    expect(spec.paths?.['/v1/saved-searches/{id}/run']).toBeDefined();
    expect(spec.components?.schemas?.SavedSearchDefinition).toBeDefined();
    expect(spec.components?.schemas?.SavedSearchRunResult).toBeDefined();
  });

  it('documents custom field endpoints and schemas', () => {
    const spec = generateRuntimeOpenApiSpec();

    expect(spec.paths?.['/v1/custom-field-definitions']).toBeDefined();
    expect(spec.paths?.['/v1/custom-field-definitions/validate']).toBeDefined();
    expect(spec.paths?.['/v1/custom-field-definitions/validate-values']).toBeDefined();
    expect(spec.paths?.['/v1/custom-field-definitions/{id}']).toBeDefined();
    expect(spec.components?.schemas?.CustomFieldDefinition).toBeDefined();
    expect(spec.components?.schemas?.CustomFieldValuesValidationResult).toBeDefined();
  });

  it('documents custom record endpoints and schemas', () => {
    const spec = generateRuntimeOpenApiSpec();

    expect(spec.paths?.['/v1/custom-record-types']).toBeDefined();
    expect(spec.paths?.['/v1/custom-record-types/validate']).toBeDefined();
    expect(spec.paths?.['/v1/custom-record-types/{id}']).toBeDefined();
    expect(spec.paths?.['/v1/custom-record-types/{id}/ontology']).toBeDefined();
    expect(spec.paths?.['/v1/custom-records']).toBeDefined();
    expect(spec.paths?.['/v1/custom-records/validate']).toBeDefined();
    expect(spec.paths?.['/v1/custom-records/{id}']).toBeDefined();
    expect(spec.components?.schemas?.CustomRecordType).toBeDefined();
    expect(spec.components?.schemas?.CustomRecord).toBeDefined();
    expect(spec.components?.schemas?.CustomRecordValuesValidationResult).toBeDefined();
  });
});
