import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  compileCustomRecordOntologyRecord,
  createCustomRecordSchema,
  createCustomRecordTypeDefinitionSchema,
  customRecordValuesValidationInputSchema,
  updateCustomRecordSchema,
  updateCustomRecordTypeDefinitionSchema,
  validateCustomRecordTypeDefinition,
  validateCustomRecordValues,
  type CustomRecord,
  type CustomRecordTypeDefinition,
} from '@glapi/types/custom-records';
import { resolveRequestUser } from './auth';

type CustomRecordRouteUser = {
  entityId?: string;
  organizationId: string;
  role?: 'user' | 'admin' | string;
};

type CustomRecordRouteOptions = {
  resolveUser?: (request: FastifyRequest) => Promise<CustomRecordRouteUser>;
};

type IdParams = {
  id: string;
};

type CustomRecordTypeListQuery = {
  recordKey?: string;
  lifecycle?: string;
};

type CustomRecordListQuery = {
  recordTypeId?: string;
  recordKey?: string;
  lifecycle?: string;
};

const customRecordTypeStore = new Map<string, Map<string, CustomRecordTypeDefinition>>();
const customRecordStore = new Map<string, Map<string, CustomRecord>>();

function organizationTypeStore(organizationId: string): Map<string, CustomRecordTypeDefinition> {
  let store = customRecordTypeStore.get(organizationId);
  if (!store) {
    store = new Map<string, CustomRecordTypeDefinition>();
    customRecordTypeStore.set(organizationId, store);
  }
  return store;
}

function organizationRecordStore(organizationId: string): Map<string, CustomRecord> {
  let store = customRecordStore.get(organizationId);
  if (!store) {
    store = new Map<string, CustomRecord>();
    customRecordStore.set(organizationId, store);
  }
  return store;
}

function actorId(user: CustomRecordRouteUser): string {
  return String(user.entityId ?? 'system');
}

function isAdmin(user: CustomRecordRouteUser): boolean {
  return user.role === 'admin';
}

function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return reply.status(statusCode).send({
    error: {
      code,
      message,
      details,
    },
  });
}

function listTypes(user: CustomRecordRouteUser): CustomRecordTypeDefinition[] {
  return Array.from(organizationTypeStore(user.organizationId).values())
    .sort((a, b) => a.recordKey.localeCompare(b.recordKey));
}

function listRecords(user: CustomRecordRouteUser): CustomRecord[] {
  return Array.from(organizationRecordStore(user.organizationId).values())
    .sort((a, b) => a.recordKey.localeCompare(b.recordKey) || a.name.localeCompare(b.name));
}

function findType(
  user: CustomRecordRouteUser,
  input: { recordTypeId?: string; recordKey?: string },
): CustomRecordTypeDefinition | undefined {
  const store = organizationTypeStore(user.organizationId);
  if (input.recordTypeId) {
    return store.get(input.recordTypeId);
  }

  if (input.recordKey) {
    return Array.from(store.values()).find((type) => type.recordKey === input.recordKey);
  }

  return undefined;
}

function nextRecordName(recordType: CustomRecordTypeDefinition, values: Record<string, unknown>): string | undefined {
  if (recordType.nameFieldKey) {
    const value = values[recordType.nameFieldKey];
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
  }

  if (recordType.numbering.mode === 'auto') {
    const number = String(recordType.numbering.nextNumber).padStart(recordType.numbering.minDigits, '0');
    return `${recordType.numbering.prefix ?? ''}${number}`;
  }

  return undefined;
}

function advanceNumbering(
  user: CustomRecordRouteUser,
  recordType: CustomRecordTypeDefinition,
): void {
  if (recordType.numbering.mode !== 'auto') return;

  organizationTypeStore(user.organizationId).set(recordType.id, {
    ...recordType,
    numbering: {
      ...recordType.numbering,
      nextNumber: recordType.numbering.nextNumber + 1,
    },
    updatedAt: new Date().toISOString(),
  });
}

export function resetCustomRecordStoreForTests(): void {
  customRecordTypeStore.clear();
  customRecordStore.clear();
}

export async function registerCustomRecordRoutes(
  server: FastifyInstance,
  options: CustomRecordRouteOptions = {},
): Promise<void> {
  const getUser = options.resolveUser ?? resolveRequestUser;

  server.get<{ Querystring: CustomRecordTypeListQuery }>(
    '/api/custom-record-types',
    async (request) => {
      const user = await getUser(request);
      const customRecordTypes = listTypes(user).filter((recordType) => {
        if (request.query.recordKey && recordType.recordKey !== request.query.recordKey) {
          return false;
        }

        if (request.query.lifecycle && recordType.lifecycle !== request.query.lifecycle) {
          return false;
        }

        return true;
      });

      return {
        count: customRecordTypes.length,
        customRecordTypes,
      };
    },
  );

  server.post('/api/custom-record-types/validate', async (request) => {
    const user = await getUser(request);
    return validateCustomRecordTypeDefinition(request.body, listTypes(user));
  });

  server.post('/api/custom-record-types', async (request, reply) => {
    const user = await getUser(request);
    if (!isAdmin(user)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Only admins can create custom record types');
    }

    const parsed = createCustomRecordTypeDefinitionSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Invalid custom record type payload', parsed.error.flatten());
    }

    const validation = validateCustomRecordTypeDefinition(parsed.data, listTypes(user));
    if (!validation.valid) {
      return sendError(reply, 422, 'VALIDATION_FAILED', 'Custom record type is invalid', validation.issues);
    }

    const now = new Date().toISOString();
    const customRecordType: CustomRecordTypeDefinition = {
      id: randomUUID(),
      organizationId: user.organizationId,
      ...parsed.data,
      createdBy: actorId(user),
      createdAt: now,
      updatedAt: now,
    };

    organizationTypeStore(user.organizationId).set(customRecordType.id, customRecordType);
    return reply.status(201).send({ customRecordType });
  });

  server.get<{ Params: IdParams }>(
    '/api/custom-record-types/:id',
    async (request, reply) => {
      const user = await getUser(request);
      const customRecordType = organizationTypeStore(user.organizationId).get(request.params.id);
      if (!customRecordType) {
        return sendError(reply, 404, 'NOT_FOUND', `Custom record type "${request.params.id}" was not found`);
      }

      return { customRecordType };
    },
  );

  server.get<{ Params: IdParams }>(
    '/api/custom-record-types/:id/ontology',
    async (request, reply) => {
      const user = await getUser(request);
      const customRecordType = organizationTypeStore(user.organizationId).get(request.params.id);
      if (!customRecordType) {
        return sendError(reply, 404, 'NOT_FOUND', `Custom record type "${request.params.id}" was not found`);
      }

      return { ontologyRecord: compileCustomRecordOntologyRecord(customRecordType) };
    },
  );

  server.put<{ Params: IdParams }>(
    '/api/custom-record-types/:id',
    async (request, reply) => {
      const user = await getUser(request);
      if (!isAdmin(user)) {
        return sendError(reply, 403, 'FORBIDDEN', 'Only admins can update custom record types');
      }

      const store = organizationTypeStore(user.organizationId);
      const existing = store.get(request.params.id);
      if (!existing) {
        return sendError(reply, 404, 'NOT_FOUND', `Custom record type "${request.params.id}" was not found`);
      }

      const parsed = updateCustomRecordTypeDefinitionSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Invalid custom record type payload', parsed.error.flatten());
      }

      const candidate = {
        ...existing,
        ...parsed.data,
      };
      const validation = validateCustomRecordTypeDefinition(
        candidate,
        listTypes(user).filter((recordType) => recordType.id !== existing.id),
      );
      if (!validation.valid) {
        return sendError(reply, 422, 'VALIDATION_FAILED', 'Custom record type is invalid', validation.issues);
      }

      const customRecordType: CustomRecordTypeDefinition = {
        ...candidate,
        updatedAt: new Date().toISOString(),
      };
      store.set(customRecordType.id, customRecordType);

      return { customRecordType };
    },
  );

  server.delete<{ Params: IdParams }>(
    '/api/custom-record-types/:id',
    async (request, reply) => {
      const user = await getUser(request);
      if (!isAdmin(user)) {
        return sendError(reply, 403, 'FORBIDDEN', 'Only admins can delete custom record types');
      }

      const store = organizationTypeStore(user.organizationId);
      const existing = store.get(request.params.id);
      if (!existing) {
        return sendError(reply, 404, 'NOT_FOUND', `Custom record type "${request.params.id}" was not found`);
      }

      const hasRecords = listRecords(user).some((record) => record.recordTypeId === existing.id);
      if (hasRecords) {
        return sendError(
          reply,
          409,
          'CUSTOM_RECORD_TYPE_IN_USE',
          `Custom record type "${request.params.id}" has records and cannot be deleted`,
        );
      }

      store.delete(request.params.id);
      return reply.status(204).send();
    },
  );

  server.get<{ Querystring: CustomRecordListQuery }>(
    '/api/custom-records',
    async (request) => {
      const user = await getUser(request);
      const customRecords = listRecords(user).filter((record) => {
        if (request.query.recordTypeId && record.recordTypeId !== request.query.recordTypeId) {
          return false;
        }

        if (request.query.recordKey && record.recordKey !== request.query.recordKey) {
          return false;
        }

        if (request.query.lifecycle && record.lifecycle !== request.query.lifecycle) {
          return false;
        }

        return true;
      });

      return {
        count: customRecords.length,
        customRecords,
      };
    },
  );

  server.post('/api/custom-records/validate', async (request, reply) => {
    const user = await getUser(request);
    const parsed = customRecordValuesValidationInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Invalid custom record values payload', parsed.error.flatten());
    }

    const customRecordType = findType(user, parsed.data);
    if (!customRecordType) {
      return sendError(reply, 404, 'NOT_FOUND', 'Custom record type was not found');
    }

    return validateCustomRecordValues(parsed.data, customRecordType);
  });

  server.post('/api/custom-records', async (request, reply) => {
    const user = await getUser(request);
    const parsed = createCustomRecordSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Invalid custom record payload', parsed.error.flatten());
    }

    const customRecordType = findType(user, parsed.data);
    if (!customRecordType) {
      return sendError(reply, 404, 'NOT_FOUND', 'Custom record type was not found');
    }

    const validation = validateCustomRecordValues(parsed.data, customRecordType);
    if (!validation.valid) {
      return sendError(reply, 422, 'VALIDATION_FAILED', 'Custom record is invalid', validation.issues);
    }

    const now = new Date().toISOString();
    const name = parsed.data.name ?? nextRecordName(customRecordType, validation.normalizedValues);
    if (!name) {
      return sendError(reply, 422, 'VALIDATION_FAILED', 'Custom record name is required');
    }

    const customRecord: CustomRecord = {
      id: randomUUID(),
      organizationId: user.organizationId,
      recordTypeId: customRecordType.id,
      recordKey: customRecordType.recordKey,
      externalId: parsed.data.externalId,
      name,
      lifecycle: parsed.data.lifecycle,
      values: validation.normalizedValues,
      createdBy: actorId(user),
      createdAt: now,
      updatedAt: now,
    };

    organizationRecordStore(user.organizationId).set(customRecord.id, customRecord);
    advanceNumbering(user, customRecordType);

    return reply.status(201).send({ customRecord });
  });

  server.get<{ Params: IdParams }>(
    '/api/custom-records/:id',
    async (request, reply) => {
      const user = await getUser(request);
      const customRecord = organizationRecordStore(user.organizationId).get(request.params.id);
      if (!customRecord) {
        return sendError(reply, 404, 'NOT_FOUND', `Custom record "${request.params.id}" was not found`);
      }

      return { customRecord };
    },
  );

  server.put<{ Params: IdParams }>(
    '/api/custom-records/:id',
    async (request, reply) => {
      const user = await getUser(request);
      const store = organizationRecordStore(user.organizationId);
      const existing = store.get(request.params.id);
      if (!existing) {
        return sendError(reply, 404, 'NOT_FOUND', `Custom record "${request.params.id}" was not found`);
      }

      const parsed = updateCustomRecordSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Invalid custom record payload', parsed.error.flatten());
      }

      const customRecordType = findType(user, { recordTypeId: existing.recordTypeId });
      if (!customRecordType) {
        return sendError(reply, 409, 'CUSTOM_RECORD_TYPE_MISSING', 'Custom record type was not found');
      }

      const values = parsed.data.values ? { ...existing.values, ...parsed.data.values } : existing.values;
      const name = parsed.data.name ?? nextRecordName(customRecordType, values) ?? existing.name;
      const validation = validateCustomRecordValues({ name, values }, customRecordType);
      if (!validation.valid) {
        return sendError(reply, 422, 'VALIDATION_FAILED', 'Custom record is invalid', validation.issues);
      }

      const customRecord: CustomRecord = {
        ...existing,
        ...parsed.data,
        name,
        values: validation.normalizedValues,
        updatedAt: new Date().toISOString(),
      };
      store.set(customRecord.id, customRecord);

      return { customRecord };
    },
  );

  server.delete<{ Params: IdParams }>(
    '/api/custom-records/:id',
    async (request, reply) => {
      const user = await getUser(request);
      const store = organizationRecordStore(user.organizationId);
      if (!store.has(request.params.id)) {
        return sendError(reply, 404, 'NOT_FOUND', `Custom record "${request.params.id}" was not found`);
      }

      store.delete(request.params.id);
      return reply.status(204).send();
    },
  );
}
