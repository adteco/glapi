import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import {
  registerSavedSearchRoutes,
  resetSavedSearchStoreForTests,
} from '../saved-search-routes';

const user = {
  entityId: '00000000-0000-0000-0000-000000000001',
  organizationId: 'org_123',
  role: 'user',
};

const customerSearch = {
  name: 'Active Customers',
  visibility: 'shared',
  definition: {
    recordKey: 'customer',
    columns: [
      { fieldKey: 'name' },
      { fieldKey: 'email' },
    ],
    filters: [
      { fieldKey: 'status', operator: 'eq', value: 'active' },
    ],
    sort: [
      { fieldKey: 'name', direction: 'asc' },
    ],
  },
};

async function buildSavedSearchTestServer() {
  const server = Fastify();
  await server.register(registerSavedSearchRoutes, {
    resolveUser: async () => user,
  });
  return server;
}

afterEach(() => {
  resetSavedSearchStoreForTests();
});

describe('saved search routes', () => {
  it('validates an ontology-backed definition', async () => {
    const server = await buildSavedSearchTestServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/saved-searches/validate',
      payload: customerSearch.definition,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('creates and lists saved searches', async () => {
    const server = await buildSavedSearchTestServer();
    const createResponse = await server.inject({
      method: 'POST',
      url: '/api/saved-searches',
      payload: customerSearch,
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().savedSearch).toMatchObject({
      name: 'Active Customers',
      organizationId: 'org_123',
      visibility: 'shared',
    });

    const listResponse = await server.inject({
      method: 'GET',
      url: '/api/saved-searches?recordKey=customer',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().count).toBe(1);
    expect(listResponse.json().savedSearches[0].name).toBe('Active Customers');
  });

  it('rejects invalid saved search definitions', async () => {
    const server = await buildSavedSearchTestServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/saved-searches',
      payload: {
        name: 'Bad Search',
        definition: {
          recordKey: 'customer',
          columns: [{ fieldKey: 'doesNotExist' }],
        },
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('VALIDATION_FAILED');
  });

  it('runs saved searches as query plans before database execution is wired', async () => {
    const server = await buildSavedSearchTestServer();
    const createResponse = await server.inject({
      method: 'POST',
      url: '/api/saved-searches',
      payload: customerSearch,
    });
    const id = createResponse.json().savedSearch.id;

    const runResponse = await server.inject({
      method: 'POST',
      url: `/api/saved-searches/${id}/run`,
      payload: { page: 1, pageSize: 25 },
    });

    expect(runResponse.statusCode).toBe(200);
    expect(runResponse.json()).toMatchObject({
      executionMode: 'planned',
      page: 1,
      pageSize: 25,
      totalRows: 0,
      rows: [],
      plan: {
        recordKey: 'customer',
        recordLabel: 'Customer',
      },
    });
  });

  it('updates and deletes saved searches', async () => {
    const server = await buildSavedSearchTestServer();
    const createResponse = await server.inject({
      method: 'POST',
      url: '/api/saved-searches',
      payload: customerSearch,
    });
    const id = createResponse.json().savedSearch.id;

    const updateResponse = await server.inject({
      method: 'PUT',
      url: `/api/saved-searches/${id}`,
      payload: { name: 'Renamed Customers' },
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().savedSearch.name).toBe('Renamed Customers');

    const deleteResponse = await server.inject({
      method: 'DELETE',
      url: `/api/saved-searches/${id}`,
    });
    expect(deleteResponse.statusCode).toBe(204);
  });
});
