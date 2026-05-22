import { describe, expect, it } from 'vitest';
import { generateRuntimeOpenApiSpec } from '../openapi';

describe('runtime OpenAPI spec', () => {
  it('documents ontology endpoints and schemas', () => {
    const spec = generateRuntimeOpenApiSpec();

    expect(spec.paths?.['/api/ontology']).toBeDefined();
    expect(spec.paths?.['/api/ontology/records']).toBeDefined();
    expect(spec.paths?.['/api/ontology/records/{key}']).toBeDefined();
    expect(spec.paths?.['/api/ontology/events']).toBeDefined();
    expect(spec.components?.schemas?.OntologyRecordDefinition).toBeDefined();
    expect(spec.components?.schemas?.OntologyEventsResponse).toBeDefined();
  });

  it('documents saved search endpoints and schemas', () => {
    const spec = generateRuntimeOpenApiSpec();

    expect(spec.paths?.['/api/saved-searches']).toBeDefined();
    expect(spec.paths?.['/api/saved-searches/validate']).toBeDefined();
    expect(spec.paths?.['/api/saved-searches/run']).toBeDefined();
    expect(spec.paths?.['/api/saved-searches/{id}']).toBeDefined();
    expect(spec.paths?.['/api/saved-searches/{id}/run']).toBeDefined();
    expect(spec.components?.schemas?.SavedSearchDefinition).toBeDefined();
    expect(spec.components?.schemas?.SavedSearchRunResult).toBeDefined();
  });
});
