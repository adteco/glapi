import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import {
  registerCustomRecordRoutes,
  resetCustomRecordStoreForTests,
} from '../custom-record-routes';
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

const contractType = {
  recordKey: 'customer_contract',
  label: 'Customer Contract',
  pluralLabel: 'Customer Contracts',
  fields: [
    {
      key: 'contractName',
      label: 'Contract Name',
      type: 'string',
      required: true,
      searchable: true,
      sortable: true,
    },
    {
      key: 'customerId',
      label: 'Customer',
      type: 'reference',
      referenceTo: 'customer',
      required: true,
      filterable: true,
    },
    {
      key: 'status',
      label: 'Status',
      type: 'enum',
      enumValues: ['draft', 'active', 'expired'],
      required: true,
      filterable: true,
    },
  ],
  relationships: [
    {
      key: 'customer',
      label: 'Customer',
      type: 'belongs_to',
      targetRecordKey: 'customer',
      sourceFieldKey: 'customerId',
    },
  ],
  nameFieldKey: 'contractName',
};

async function buildCustomRecordTestServer(user = adminUser) {
  const server = Fastify();
  await server.register(registerCustomFieldRoutes, {
    resolveUser: async () => user,
  });
  await server.register(registerCustomRecordRoutes, {
    resolveUser: async () => user,
  });
  return server;
}

async function createRecordType(server: Awaited<ReturnType<typeof buildCustomRecordTestServer>>) {
  return server.inject({
    method: 'POST',
    url: '/api/custom-record-types',
    payload: contractType,
  });
}

afterEach(() => {
  resetCustomFieldStoreForTests();
  resetCustomRecordStoreForTests();
});

describe('custom record routes', () => {
  it('validates custom record type definitions', async () => {
    const server = await buildCustomRecordTestServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/custom-record-types/validate',
      payload: contractType,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('creates, lists, and exposes custom record type ontology', async () => {
    const server = await buildCustomRecordTestServer();
    const createResponse = await createRecordType(server);

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().customRecordType).toMatchObject({
      organizationId: 'org_123',
      recordKey: 'customer_contract',
      lifecycle: 'active',
    });

    const id = createResponse.json().customRecordType.id;
    const listResponse = await server.inject({
      method: 'GET',
      url: '/api/custom-record-types?recordKey=customer_contract',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().count).toBe(1);

    const ontologyResponse = await server.inject({
      method: 'GET',
      url: `/api/custom-record-types/${id}/ontology`,
    });

    expect(ontologyResponse.statusCode).toBe(200);
    expect(ontologyResponse.json().ontologyRecord).toMatchObject({
      key: 'customer_contract',
      storage: 'custom_record',
      extensionOf: 'custom_record',
    });
  });

  it('rejects non-admin custom record type writes', async () => {
    const server = await buildCustomRecordTestServer(regularUser);
    const response = await server.inject({
      method: 'POST',
      url: '/api/custom-record-types',
      payload: contractType,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('validates custom record values against the selected type', async () => {
    const server = await buildCustomRecordTestServer();
    await createRecordType(server);

    const response = await server.inject({
      method: 'POST',
      url: '/api/custom-records/validate',
      payload: {
        recordKey: 'customer_contract',
        values: {
          contractName: 'MSA 2026',
          customerId: 'customer_123',
          status: 'active',
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      valid: true,
      issues: [],
      normalizedValues: {
        contractName: 'MSA 2026',
        customerId: 'customer_123',
        status: 'active',
      },
    });
  });

  it('creates, updates, lists, and deletes custom records', async () => {
    const server = await buildCustomRecordTestServer();
    await createRecordType(server);

    const createResponse = await server.inject({
      method: 'POST',
      url: '/api/custom-records',
      payload: {
        recordKey: 'customer_contract',
        values: {
          contractName: 'MSA 2026',
          customerId: 'customer_123',
          status: 'draft',
        },
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().customRecord).toMatchObject({
      recordKey: 'customer_contract',
      name: 'MSA 2026',
      values: {
        status: 'draft',
      },
    });

    const id = createResponse.json().customRecord.id;
    const updateResponse = await server.inject({
      method: 'PUT',
      url: `/api/custom-records/${id}`,
      payload: {
        values: {
          status: 'active',
        },
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().customRecord.values.status).toBe('active');

    const listResponse = await server.inject({
      method: 'GET',
      url: '/api/custom-records?recordKey=customer_contract',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().count).toBe(1);

    const deleteResponse = await server.inject({
      method: 'DELETE',
      url: `/api/custom-records/${id}`,
    });

    expect(deleteResponse.statusCode).toBe(204);
  });

  it('enforces custom field definitions on custom record writes', async () => {
    const server = await buildCustomRecordTestServer();
    await createRecordType(server);
    const fieldResponse = await server.inject({
      method: 'POST',
      url: '/api/custom-field-definitions',
      payload: {
        recordKey: 'customer_contract',
        fieldKey: 'approvalStatus',
        label: 'Approval Status',
        type: 'enum',
        required: true,
        validation: {
          enumValues: ['pending', 'approved'],
        },
      },
    });

    expect(fieldResponse.statusCode).toBe(201);

    const invalidResponse = await server.inject({
      method: 'POST',
      url: '/api/custom-records',
      payload: {
        recordKey: 'customer_contract',
        values: {
          contractName: 'MSA 2026',
          customerId: 'customer_123',
          status: 'draft',
        },
        customFields: {
          approvalStatus: 'rejected',
        },
      },
    });

    expect(invalidResponse.statusCode).toBe(422);
    expect(invalidResponse.json().error.details[0].code).toBe('enum_value_not_allowed');

    const createResponse = await server.inject({
      method: 'POST',
      url: '/api/custom-records',
      payload: {
        recordKey: 'customer_contract',
        values: {
          contractName: 'MSA 2026',
          customerId: 'customer_123',
          status: 'draft',
        },
        customFields: {
          approvalStatus: 'pending',
        },
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().customRecord.customFields).toEqual({
      approvalStatus: 'pending',
    });
  });
});
