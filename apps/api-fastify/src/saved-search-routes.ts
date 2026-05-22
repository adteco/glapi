import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  compileSavedSearchQueryPlan,
  createSavedSearchSchema,
  runSavedSearchSchema,
  savedSearchDefinitionSchema,
  updateSavedSearchSchema,
  validateSavedSearchDefinition,
  type SavedSearch,
} from '@glapi/types/saved-searches';
import { resolveRequestUser } from './auth';

type SavedSearchRouteUser = {
  entityId?: string;
  organizationId: string;
  role?: 'user' | 'admin' | string;
};

type SavedSearchRouteOptions = {
  resolveUser?: (request: FastifyRequest) => Promise<SavedSearchRouteUser>;
};

type SavedSearchParams = {
  id: string;
};

type SavedSearchListQuery = {
  recordKey?: string;
  visibility?: string;
};

const savedSearchStore = new Map<string, Map<string, SavedSearch>>();

function organizationStore(organizationId: string): Map<string, SavedSearch> {
  let store = savedSearchStore.get(organizationId);
  if (!store) {
    store = new Map<string, SavedSearch>();
    savedSearchStore.set(organizationId, store);
  }
  return store;
}

function actorId(user: SavedSearchRouteUser): string {
  return String(user.entityId ?? 'system');
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

function canRead(search: SavedSearch, user: SavedSearchRouteUser): boolean {
  if (search.visibility === 'system' || search.visibility === 'shared') return true;
  return search.createdBy === actorId(user);
}

function canWrite(search: SavedSearch, user: SavedSearchRouteUser): boolean {
  if (search.visibility === 'system') return user.role === 'admin';
  return search.createdBy === actorId(user) || user.role === 'admin';
}

function visibleSearches(user: SavedSearchRouteUser): SavedSearch[] {
  return Array.from(organizationStore(user.organizationId).values())
    .filter((search) => canRead(search, user))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function resetSavedSearchStoreForTests(): void {
  savedSearchStore.clear();
}

export async function registerSavedSearchRoutes(
  server: FastifyInstance,
  options: SavedSearchRouteOptions = {},
): Promise<void> {
  const getUser = options.resolveUser ?? resolveRequestUser;

  server.get<{ Querystring: SavedSearchListQuery }>(
    '/api/saved-searches',
    async (request) => {
      const user = await getUser(request);
      const searches = visibleSearches(user).filter((search) => {
        if (request.query.recordKey && search.definition.recordKey !== request.query.recordKey) {
          return false;
        }

        if (request.query.visibility && search.visibility !== request.query.visibility) {
          return false;
        }

        return true;
      });

      return {
        count: searches.length,
        savedSearches: searches,
      };
    }
  );

  server.post('/api/saved-searches/validate', async (request) => {
    const body = request.body as { definition?: unknown };
    return validateSavedSearchDefinition(body.definition ?? body);
  });

  server.post('/api/saved-searches/run', async (request, reply) => {
    const body = runSavedSearchSchema.safeParse(request.body ?? {});
    if (!body.success || !body.data.definition) {
      return sendError(reply, 400, 'BAD_REQUEST', 'A saved search definition is required', body.success ? undefined : body.error.flatten());
    }

    const validation = validateSavedSearchDefinition(body.data.definition);
    if (!validation.valid) {
      return sendError(reply, 422, 'VALIDATION_FAILED', 'Saved search definition is invalid', validation.issues);
    }

    const definition = savedSearchDefinitionSchema.parse(body.data.definition);
    const plan = compileSavedSearchQueryPlan({
      ...definition,
      pageSize: body.data.pageSize ?? definition.pageSize,
    });

    return {
      executionMode: 'planned',
      plan,
      rows: [],
      page: body.data.page,
      pageSize: plan.pageSize,
      totalRows: 0,
    };
  });

  server.post('/api/saved-searches', async (request, reply) => {
    const user = await getUser(request);
    const parsed = createSavedSearchSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Invalid saved search payload', parsed.error.flatten());
    }

    if (parsed.data.visibility === 'system' && user.role !== 'admin') {
      return sendError(reply, 403, 'FORBIDDEN', 'Only admins can create system saved searches');
    }

    const validation = validateSavedSearchDefinition(parsed.data.definition);
    if (!validation.valid) {
      return sendError(reply, 422, 'VALIDATION_FAILED', 'Saved search definition is invalid', validation.issues);
    }

    const now = new Date().toISOString();
    const savedSearch: SavedSearch = {
      id: randomUUID(),
      organizationId: user.organizationId,
      name: parsed.data.name,
      description: parsed.data.description,
      visibility: parsed.data.visibility,
      definition: parsed.data.definition,
      createdBy: actorId(user),
      createdAt: now,
      updatedAt: now,
    };

    organizationStore(user.organizationId).set(savedSearch.id, savedSearch);
    return reply.status(201).send({ savedSearch });
  });

  server.get<{ Params: SavedSearchParams }>(
    '/api/saved-searches/:id',
    async (request, reply) => {
      const user = await getUser(request);
      const savedSearch = organizationStore(user.organizationId).get(request.params.id);
      if (!savedSearch || !canRead(savedSearch, user)) {
        return sendError(reply, 404, 'NOT_FOUND', `Saved search "${request.params.id}" was not found`);
      }

      return { savedSearch };
    }
  );

  server.put<{ Params: SavedSearchParams }>(
    '/api/saved-searches/:id',
    async (request, reply) => {
      const user = await getUser(request);
      const store = organizationStore(user.organizationId);
      const existing = store.get(request.params.id);
      if (!existing || !canRead(existing, user)) {
        return sendError(reply, 404, 'NOT_FOUND', `Saved search "${request.params.id}" was not found`);
      }

      if (!canWrite(existing, user)) {
        return sendError(reply, 403, 'FORBIDDEN', 'You cannot update this saved search');
      }

      const parsed = updateSavedSearchSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Invalid saved search payload', parsed.error.flatten());
      }

      if (parsed.data.visibility === 'system' && user.role !== 'admin') {
        return sendError(reply, 403, 'FORBIDDEN', 'Only admins can promote saved searches to system visibility');
      }

      const nextDefinition = parsed.data.definition ?? existing.definition;
      const validation = validateSavedSearchDefinition(nextDefinition);
      if (!validation.valid) {
        return sendError(reply, 422, 'VALIDATION_FAILED', 'Saved search definition is invalid', validation.issues);
      }

      const updated: SavedSearch = {
        ...existing,
        ...parsed.data,
        definition: nextDefinition,
        updatedAt: new Date().toISOString(),
      };
      store.set(updated.id, updated);

      return { savedSearch: updated };
    }
  );

  server.delete<{ Params: SavedSearchParams }>(
    '/api/saved-searches/:id',
    async (request, reply) => {
      const user = await getUser(request);
      const store = organizationStore(user.organizationId);
      const existing = store.get(request.params.id);
      if (!existing || !canRead(existing, user)) {
        return sendError(reply, 404, 'NOT_FOUND', `Saved search "${request.params.id}" was not found`);
      }

      if (!canWrite(existing, user)) {
        return sendError(reply, 403, 'FORBIDDEN', 'You cannot delete this saved search');
      }

      store.delete(request.params.id);
      return reply.status(204).send();
    }
  );

  server.post<{ Params: SavedSearchParams }>(
    '/api/saved-searches/:id/run',
    async (request, reply) => {
      const user = await getUser(request);
      const savedSearch = organizationStore(user.organizationId).get(request.params.id);
      if (!savedSearch || !canRead(savedSearch, user)) {
        return sendError(reply, 404, 'NOT_FOUND', `Saved search "${request.params.id}" was not found`);
      }

      const body = runSavedSearchSchema.safeParse(request.body ?? {});
      if (!body.success) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Invalid run payload', body.error.flatten());
      }

      const definition = {
        ...savedSearch.definition,
        pageSize: body.data.pageSize ?? savedSearch.definition.pageSize,
      };
      const plan = compileSavedSearchQueryPlan(definition);

      return {
        executionMode: 'planned',
        plan,
        rows: [],
        page: body.data.page,
        pageSize: plan.pageSize,
        totalRows: 0,
      };
    }
  );
}
