import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import {
  registerCustomFieldRoutes,
  resetCustomFieldStoreForTests,
} from '../custom-field-routes';

const adminUser = {
  entityId: '00000000-0000-0000-0000-000000000001',
  organizationId: 'org_123',
  role: 'admin',
};

const regularUser = {
  ...adminUser,
  role: 'user',
};

const regionField = {
  recordKey: 'customer',
  fieldKey: 'customerRegion',
  label: 'Customer Region',
  type: 'enum',
  searchable: true,
  filterable: true,
  validation: {
    enumValues: ['west', 'central', 'east'],
  },
};

async function buildCustomFieldTestServer(user = adminUser) {
  const server = Fastify();
  await server.register(registerCustomFieldRoutes, {
    resolveUser: async () => user,
  });
  return server;
}

afterEach(() => {
  resetCustomFieldStoreForTests();
});

describe('custom field routes', () => {
  it('validates custom field definitions', async () => {
    const server = await buildCustomFieldTestServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/custom-field-definitions/validate',
      payload: regionField,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('creates and lists custom field definitions', async () => {
    const server = await buildCustomFieldTestServer();
    const createResponse = await server.inject({
      method: 'POST',
      url: '/api/custom-field-definitions',
      payload: regionField,
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().customFieldDefinition).toMatchObject({
      organizationId: 'org_123',
      recordKey: 'customer',
      fieldKey: 'customerRegion',
    });

    const listResponse = await server.inject({
      method: 'GET',
      url: '/api/custom-field-definitions?recordKey=customer',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().count).toBe(1);
    expect(listResponse.json().customFieldDefinitions[0].fieldKey).toBe('customerRegion');
  });

  it('rejects non-admin writes', async () => {
    const server = await buildCustomFieldTestServer(regularUser);
    const response = await server.inject({
      method: 'POST',
      url: '/api/custom-field-definitions',
      payload: regionField,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('validates custom field values against definitions', async () => {
    const server = await buildCustomFieldTestServer();
    await server.inject({
      method: 'POST',
      url: '/api/custom-field-definitions',
      payload: regionField,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/custom-field-definitions/validate-values',
      payload: {
        recordKey: 'customer',
        values: {
          customerRegion: 'west',
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      valid: true,
      issues: [],
      normalizedValues: {
        customerRegion: 'west',
      },
    });
  });

  it('updates and deletes custom field definitions', async () => {
    const server = await buildCustomFieldTestServer();
    const createResponse = await server.inject({
      method: 'POST',
      url: '/api/custom-field-definitions',
      payload: regionField,
    });
    const id = createResponse.json().customFieldDefinition.id;

    const updateResponse = await server.inject({
      method: 'PUT',
      url: `/api/custom-field-definitions/${id}`,
      payload: {
        label: 'Customer Territory',
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().customFieldDefinition.label).toBe('Customer Territory');

    const deleteResponse = await server.inject({
      method: 'DELETE',
      url: `/api/custom-field-definitions/${id}`,
    });

    expect(deleteResponse.statusCode).toBe(204);
  });
});
