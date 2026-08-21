import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerOntologyRoutes } from '../ontology-routes';

async function buildOntologyTestServer() {
  const server = Fastify();
  await server.register(registerOntologyRoutes);
  return server;
}

describe('ontology routes', () => {
  it('returns ontology version metadata', async () => {
    const server = await buildOntologyTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/v1/ontology/version',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      version: '2026.05',
    });
    expect(response.json().categories).toContain('transaction');
    expect(response.json().operations).toContain('search');
  });

  it('lists ontology records with filters', async () => {
    const server = await buildOntologyTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/v1/ontology/records?category=financial&customizable=false',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.records.map((record: { key: string }) => record.key)).toContain('gl_transaction');
    expect(body.records.every((record: { category: string }) => record.category === 'financial')).toBe(true);
    expect(body.records.every((record: { customizable: boolean }) => record.customizable === false)).toBe(true);
  });

  it('returns a single ontology record by key', async () => {
    const server = await buildOntologyTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/v1/ontology/records/customer',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().record).toMatchObject({
      key: 'customer',
      apiPath: '/v1/customers',
      customizable: true,
    });
  });

  it('rejects invalid filters', async () => {
    const server = await buildOntologyTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/v1/ontology/records?customizable=maybe',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('BAD_REQUEST');
  });

  it('lists ontology events', async () => {
    const server = await buildOntologyTestServer();
    const response = await server.inject({
      method: 'GET',
      url: '/v1/ontology/events',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'invoice.posted',
          recordKey: 'invoice',
        }),
      ])
    );
  });
});
