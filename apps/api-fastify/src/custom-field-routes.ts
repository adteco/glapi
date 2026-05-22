import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createCustomFieldDefinitionSchema,
  customFieldValuesValidationInputSchema,
  updateCustomFieldDefinitionSchema,
  validateCustomFieldDefinition,
  validateCustomFieldValues,
  type CustomFieldDefinition,
} from '@glapi/types/custom-fields';
import { resolveRequestUser } from './auth';
import {
  customFieldOrganizationStore,
  listCustomFieldDefinitionsForOrganization,
  resetCustomFieldStore,
} from './custom-field-store';
import { listCustomRecordTypesForOrganization } from './custom-record-store';

type CustomFieldRouteUser = {
  entityId?: string;
  organizationId: string;
  role?: 'user' | 'admin' | string;
};

type CustomFieldRouteOptions = {
  resolveUser?: (request: FastifyRequest) => Promise<CustomFieldRouteUser>;
};

type CustomFieldParams = {
  id: string;
};

type CustomFieldListQuery = {
  recordKey?: string;
  lifecycle?: string;
};

function actorId(user: CustomFieldRouteUser): string {
  return String(user.entityId ?? 'system');
}

function isAdmin(user: CustomFieldRouteUser): boolean {
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

function listDefinitions(user: CustomFieldRouteUser): CustomFieldDefinition[] {
  return listCustomFieldDefinitionsForOrganization(user.organizationId);
}

function customRecordKeys(user: CustomFieldRouteUser): string[] {
  return listCustomRecordTypesForOrganization(user.organizationId).map((recordType) => recordType.recordKey);
}

export function resetCustomFieldStoreForTests(): void {
  resetCustomFieldStore();
}

export async function registerCustomFieldRoutes(
  server: FastifyInstance,
  options: CustomFieldRouteOptions = {},
): Promise<void> {
  const getUser = options.resolveUser ?? resolveRequestUser;

  server.get<{ Querystring: CustomFieldListQuery }>(
    '/api/custom-field-definitions',
    async (request) => {
      const user = await getUser(request);
      const definitions = listDefinitions(user).filter((definition) => {
        if (request.query.recordKey && definition.recordKey !== request.query.recordKey) {
          return false;
        }

        if (request.query.lifecycle && definition.lifecycle !== request.query.lifecycle) {
          return false;
        }

        return true;
      });

      return {
        count: definitions.length,
        customFieldDefinitions: definitions,
      };
    }
  );

  server.post('/api/custom-field-definitions/validate', async (request) => {
    const user = await getUser(request);
    return validateCustomFieldDefinition(
      request.body,
      listDefinitions(user),
      { customRecordKeys: customRecordKeys(user) },
    );
  });

  server.post('/api/custom-field-definitions/validate-values', async (request, reply) => {
    const user = await getUser(request);
    const parsed = customFieldValuesValidationInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Invalid custom field values payload', parsed.error.flatten());
    }

    return validateCustomFieldValues(parsed.data, listDefinitions(user));
  });

  server.post('/api/custom-field-definitions', async (request, reply) => {
    const user = await getUser(request);
    if (!isAdmin(user)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Only admins can create custom field definitions');
    }

    const parsed = createCustomFieldDefinitionSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Invalid custom field definition payload', parsed.error.flatten());
    }

    const existingDefinitions = listDefinitions(user);
    const validation = validateCustomFieldDefinition(
      parsed.data,
      existingDefinitions,
      { customRecordKeys: customRecordKeys(user) },
    );
    if (!validation.valid) {
      return sendError(reply, 422, 'VALIDATION_FAILED', 'Custom field definition is invalid', validation.issues);
    }

    const now = new Date().toISOString();
    const definition: CustomFieldDefinition = {
      id: randomUUID(),
      organizationId: user.organizationId,
      ...parsed.data,
      createdBy: actorId(user),
      createdAt: now,
      updatedAt: now,
    };

    customFieldOrganizationStore(user.organizationId).set(definition.id, definition);
    return reply.status(201).send({ customFieldDefinition: definition });
  });

  server.get<{ Params: CustomFieldParams }>(
    '/api/custom-field-definitions/:id',
    async (request, reply) => {
      const user = await getUser(request);
      const definition = customFieldOrganizationStore(user.organizationId).get(request.params.id);
      if (!definition) {
        return sendError(reply, 404, 'NOT_FOUND', `Custom field definition "${request.params.id}" was not found`);
      }

      return { customFieldDefinition: definition };
    }
  );

  server.put<{ Params: CustomFieldParams }>(
    '/api/custom-field-definitions/:id',
    async (request, reply) => {
      const user = await getUser(request);
      if (!isAdmin(user)) {
        return sendError(reply, 403, 'FORBIDDEN', 'Only admins can update custom field definitions');
      }

      const store = customFieldOrganizationStore(user.organizationId);
      const existing = store.get(request.params.id);
      if (!existing) {
        return sendError(reply, 404, 'NOT_FOUND', `Custom field definition "${request.params.id}" was not found`);
      }

      const parsed = updateCustomFieldDefinitionSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Invalid custom field definition payload', parsed.error.flatten());
      }

      const candidate = {
        ...existing,
        ...parsed.data,
      };
      const existingDefinitions = listDefinitions(user).filter((definition) => definition.id !== existing.id);
      const validation = validateCustomFieldDefinition(
        candidate,
        existingDefinitions,
        { customRecordKeys: customRecordKeys(user) },
      );
      if (!validation.valid) {
        return sendError(reply, 422, 'VALIDATION_FAILED', 'Custom field definition is invalid', validation.issues);
      }

      const updated: CustomFieldDefinition = {
        ...candidate,
        updatedAt: new Date().toISOString(),
      };
      store.set(updated.id, updated);

      return { customFieldDefinition: updated };
    }
  );

  server.delete<{ Params: CustomFieldParams }>(
    '/api/custom-field-definitions/:id',
    async (request, reply) => {
      const user = await getUser(request);
      if (!isAdmin(user)) {
        return sendError(reply, 403, 'FORBIDDEN', 'Only admins can delete custom field definitions');
      }

      const store = customFieldOrganizationStore(user.organizationId);
      if (!store.has(request.params.id)) {
        return sendError(reply, 404, 'NOT_FOUND', `Custom field definition "${request.params.id}" was not found`);
      }

      store.delete(request.params.id);
      return reply.status(204).send();
    }
  );
}
