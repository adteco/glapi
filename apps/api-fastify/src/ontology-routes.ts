import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  ONTOLOGY_REGISTRY,
  getOntologyRecord,
  listOntologyRecords,
  ontologyFieldTypeSchema,
  ontologyLifecycleStateSchema,
  ontologyOperationSchema,
  ontologyRecordCategorySchema,
  type OntologyOperation,
  type OntologyRecordCategory,
  type OntologyRecordDefinition,
} from '@glapi/types/ontology';

type OntologyRecordsQuery = {
  category?: string;
  customizable?: string;
  operation?: string;
};

type OntologyRecordParams = {
  key: string;
};

function sendBadRequest(reply: FastifyReply, message: string) {
  return reply.status(400).send({
    error: {
      code: 'BAD_REQUEST',
      message,
    },
  });
}

function parseBooleanQuery(value: string | undefined, fieldName: string): boolean | undefined {
  if (value === undefined) return undefined;

  switch (value.toLowerCase()) {
    case 'true':
      return true;
    case 'false':
      return false;
    default:
      throw new Error(`${fieldName} must be "true" or "false"`);
  }
}

function ontologyMetadata() {
  return {
    version: ONTOLOGY_REGISTRY.version,
    recordCount: ONTOLOGY_REGISTRY.records.length,
    categories: ontologyRecordCategorySchema.options,
    fieldTypes: ontologyFieldTypeSchema.options,
    lifecycleStates: ontologyLifecycleStateSchema.options,
    operations: ontologyOperationSchema.options,
  };
}

function eventDefinitions(records: OntologyRecordDefinition[] = ONTOLOGY_REGISTRY.records) {
  return records.flatMap((record) =>
    record.events.map((name) => ({
      name,
      recordKey: record.key,
      recordLabel: record.label,
      category: record.category,
    }))
  );
}

function filterRecords(query: OntologyRecordsQuery, reply: FastifyReply) {
  const parsedCategory = query.category
    ? ontologyRecordCategorySchema.safeParse(query.category)
    : undefined;
  if (parsedCategory && !parsedCategory.success) {
    return sendBadRequest(reply, `Unknown ontology category "${query.category}"`);
  }

  const parsedOperation = query.operation
    ? ontologyOperationSchema.safeParse(query.operation)
    : undefined;
  if (parsedOperation && !parsedOperation.success) {
    return sendBadRequest(reply, `Unknown ontology operation "${query.operation}"`);
  }

  let customizable: boolean | undefined;
  try {
    customizable = parseBooleanQuery(query.customizable, 'customizable');
  } catch (error) {
    return sendBadRequest(reply, error instanceof Error ? error.message : 'Invalid query');
  }

  let records = listOntologyRecords({
    category: parsedCategory?.success
      ? (parsedCategory.data as OntologyRecordCategory)
      : undefined,
    customizable,
  });

  if (parsedOperation?.success) {
    const operation = parsedOperation.data as OntologyOperation;
    records = records.filter((record) => record.operations.includes(operation));
  }

  return records;
}

export async function registerOntologyRoutes(server: FastifyInstance): Promise<void> {
  server.get('/api/ontology/version', async () => ontologyMetadata());

  server.get('/api/ontology', async () => ({
    ...ontologyMetadata(),
    records: ONTOLOGY_REGISTRY.records,
  }));

  server.get<{ Querystring: OntologyRecordsQuery }>(
    '/api/ontology/records',
    async (request, reply) => {
      const records = filterRecords(request.query, reply);
      if (!Array.isArray(records)) return records;

      return {
        version: ONTOLOGY_REGISTRY.version,
        count: records.length,
        records,
      };
    }
  );

  server.get<{ Params: OntologyRecordParams }>(
    '/api/ontology/records/:key',
    async (request, reply) => {
      const record = getOntologyRecord(request.params.key);
      if (!record) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Ontology record "${request.params.key}" was not found`,
          },
        });
      }

      return {
        version: ONTOLOGY_REGISTRY.version,
        record,
      };
    }
  );

  server.get('/api/ontology/events', async () => ({
    version: ONTOLOGY_REGISTRY.version,
    count: eventDefinitions().length,
    events: eventDefinitions(),
  }));
}
