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
});
