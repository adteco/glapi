import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  ProjectBillingQueueService,
  ProjectBillingTransitionService,
  ProjectContractModificationService,
  ProjectRevenueGlPostingService,
  ProjectRevenuePlanService,
  ProjectRevenueRecognitionReversalService,
  ProjectRevenueRecognitionRunService,
  ServiceError,
} from '@glapi/api-service';
import { db } from '@glapi/database';
import { getRequestUser } from './auth';

type RouteUser = { organizationId: string; entityId?: string | null; id?: string };
type ServiceContext = { organizationId: string; userId?: string };

export interface ProjectAccountingServices {
  billing(context: ServiceContext): Pick<ProjectBillingQueueService, 'listCandidates' | 'previewInvoiceDrafts' | 'createInvoiceDrafts'>;
  billingTransitions(context: ServiceContext): Pick<ProjectBillingTransitionService, 'listHistory' | 'transition'>;
  plans(context: ServiceContext): Pick<ProjectRevenuePlanService, 'previewPlan' | 'generatePlan' | 'getPlan'>;
  recognition(context: ServiceContext): Pick<ProjectRevenueRecognitionRunService, 'previewRun' | 'executeRun'>;
  posting(context: ServiceContext): Pick<ProjectRevenueGlPostingService, 'postRecognitionRun' | 'postProjectInvoice'>;
  modifications(context: ServiceContext): Pick<ProjectContractModificationService, 'previewModification' | 'applyModification'>;
  reversals(context: ServiceContext): Pick<ProjectRevenueRecognitionReversalService, 'reverseRun'>;
}

export interface ProjectAccountingRouteOptions {
  resolveUser?: (request: FastifyRequest) => Promise<RouteUser>;
  services?: ProjectAccountingServices;
}

const defaultServices: ProjectAccountingServices = {
  billing: (context) => new ProjectBillingQueueService(context, { db }),
  billingTransitions: (context) => new ProjectBillingTransitionService(context, { db }),
  plans: (context) => new ProjectRevenuePlanService(context, { db }),
  recognition: (context) => new ProjectRevenueRecognitionRunService(context, { db }),
  posting: (context) => new ProjectRevenueGlPostingService(context, { db }),
  modifications: (context) => new ProjectContractModificationService(context, { db }),
  reversals: (context) => new ProjectRevenueRecognitionReversalService(context, { db }),
};

function routeContext(user: RouteUser): ServiceContext {
  return {
    organizationId: String(user.organizationId),
    userId: user.entityId ? String(user.entityId) : user.id ? String(user.id) : undefined,
  };
}

function idempotencyKey(request: FastifyRequest): string {
  const value = request.headers['idempotency-key'];
  return String(Array.isArray(value) ? value[0] ?? '' : value ?? '').trim();
}

function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof ServiceError) {
    return reply.status(error.statusCode).send({ error: error.toApiError() });
  }
  throw error;
}

async function invoke(reply: FastifyReply, operation: () => Promise<unknown>) {
  try {
    return await operation();
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function registerProjectAccountingRoutes(
  server: FastifyInstance,
  options: ProjectAccountingRouteOptions = {},
): Promise<void> {
  const resolveUser = options.resolveUser ?? getRequestUser;
  const services = options.services ?? defaultServices;
  const context = async (request: FastifyRequest) => routeContext(await resolveUser(request));

  server.get('/v1/project-billing/candidates', async (request, reply) =>
    invoke(reply, async () => {
      const query = request.query as {
        page?: string; limit?: string; customerId?: string; projectId?: string;
        sourceTypes?: string; asOfDate?: string;
      };
      return services.billing(await context(request)).listCandidates(
        { page: Number(query.page ?? 1), limit: Number(query.limit ?? 20) },
        {
          customerId: query.customerId,
          projectId: query.projectId,
          sourceTypes: query.sourceTypes
            ? (query.sourceTypes.split(',') as Array<'TIME_ENTRY' | 'PROJECT_TASK'>)
            : undefined,
          asOfDate: query.asOfDate,
        },
      );
    }));

  server.post('/v1/project-billing/preview', async (request, reply) =>
    invoke(reply, async () => services.billing(await context(request)).previewInvoiceDrafts(
      (request.body ?? {}) as Parameters<ProjectBillingQueueService['previewInvoiceDrafts']>[0],
    )));

  server.post('/v1/project-billing/drafts', async (request, reply) =>
    invoke(reply, async () => services.billing(await context(request)).createInvoiceDrafts({
      ...((request.body ?? {}) as Omit<Parameters<ProjectBillingQueueService['createInvoiceDrafts']>[0], 'idempotencyKey'>),
      idempotencyKey: idempotencyKey(request),
    })));

  server.get('/v1/project-billing/invoices', async (request, reply) =>
    invoke(reply, async () => {
      const query = request.query as { status?: 'draft' | 'billed' };
      return services.billingTransitions(await context(request)).listHistory(query.status);
    }));

  server.post<{ Params: { invoiceId: string } }>('/v1/project-billing/invoices/:invoiceId/transitions', async (request, reply) =>
    invoke(reply, async () => services.billingTransitions(await context(request)).transition({
      ...((request.body ?? {}) as Omit<Parameters<ProjectBillingTransitionService['transition']>[0], 'invoiceId' | 'idempotencyKey'>),
      invoiceId: request.params.invoiceId,
      idempotencyKey: idempotencyKey(request),
    })));

  server.post<{ Params: { versionId: string } }>('/v1/project-revenue/plans/:versionId/preview', async (request, reply) =>
    invoke(reply, async () => services.plans(await context(request)).previewPlan(request.params.versionId)));
  server.post<{ Params: { versionId: string } }>('/v1/project-revenue/plans/:versionId', async (request, reply) =>
    invoke(reply, async () => services.plans(await context(request)).generatePlan(request.params.versionId)));
  server.get<{ Params: { versionId: string } }>('/v1/project-revenue/plans/:versionId', async (request, reply) =>
    invoke(reply, async () => services.plans(await context(request)).getPlan(request.params.versionId)));

  server.post('/v1/project-revenue/recognition-runs/preview', async (request, reply) =>
    invoke(reply, async () => services.recognition(await context(request)).previewRun(
      request.body as Parameters<ProjectRevenueRecognitionRunService['previewRun']>[0],
    )));
  server.post('/v1/project-revenue/recognition-runs', async (request, reply) =>
    invoke(reply, async () => services.recognition(await context(request)).executeRun(
      request.body as Parameters<ProjectRevenueRecognitionRunService['executeRun']>[0],
      idempotencyKey(request),
    )));

  server.post<{ Params: { runId: string } }>('/v1/project-revenue/recognition-runs/:runId/post', async (request, reply) =>
    invoke(reply, async () => services.posting(await context(request)).postRecognitionRun(
      request.params.runId,
      idempotencyKey(request),
    )));
  server.post<{ Params: { invoiceId: string } }>('/v1/project-billing/invoices/:invoiceId/post', async (request, reply) =>
    invoke(reply, async () => services.posting(await context(request)).postProjectInvoice(
      request.params.invoiceId,
      idempotencyKey(request),
    )));

  server.post('/v1/project-revenue/modifications/preview', async (request, reply) =>
    invoke(reply, async () => services.modifications(await context(request)).previewModification(
      request.body as Parameters<ProjectContractModificationService['previewModification']>[0],
    )));
  server.post('/v1/project-revenue/modifications', async (request, reply) =>
    invoke(reply, async () => services.modifications(await context(request)).applyModification(
      request.body as Parameters<ProjectContractModificationService['applyModification']>[0],
      idempotencyKey(request),
    )));
  server.post('/v1/project-revenue/recognition-reversals', async (request, reply) =>
    invoke(reply, async () => services.reversals(await context(request)).reverseRun(
      request.body as Parameters<ProjectRevenueRecognitionReversalService['reverseRun']>[0],
      idempotencyKey(request),
    )));
}
