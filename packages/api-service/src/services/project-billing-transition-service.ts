import { createHash } from "node:crypto";
import {
  ProjectBillingTransitionError,
  ProjectBillingTransitionRepository,
  type ContextualDatabase,
  type ProjectBillingTransitionAction,
} from "@glapi/database";
import { ServiceError } from "../types";
import { BaseService } from "./base-service";

export interface ProjectBillingTransitionServiceOptions {
  db?: ContextualDatabase;
  repository?: ProjectBillingTransitionRepositoryLike;
}

export interface ProjectBillingTransitionRepositoryLike {
  listHistory(
    organizationId: string,
    status?: "draft" | "billed",
  ): ReturnType<ProjectBillingTransitionRepository["listHistory"]>;
  transition(
    input: Parameters<ProjectBillingTransitionRepository["transition"]>[0],
  ): ReturnType<ProjectBillingTransitionRepository["transition"]>;
}

export interface TransitionProjectInvoiceInput {
  invoiceId: string;
  action: ProjectBillingTransitionAction;
  reason: string;
  idempotencyKey: string;
  targetInvoiceId?: string;
  invoiceDate?: string;
  dueDate?: string;
}

export class ProjectBillingTransitionService extends BaseService {
  private readonly repository: ProjectBillingTransitionRepositoryLike;

  constructor(
    context = {},
    options: ProjectBillingTransitionServiceOptions = {},
  ) {
    super(context);
    this.repository =
      options.repository ?? new ProjectBillingTransitionRepository(options.db);
  }

  listHistory(status?: "draft" | "billed") {
    return this.repository.listHistory(
      this.requireOrganizationContext(),
      status,
    );
  }

  async transition(input: TransitionProjectInvoiceInput) {
    const organizationId = this.requireOrganizationContext();
    const actorId =
      (this.context as { entityId?: string | null }).entityId ??
      this.requireUserContext();
    const canonical = JSON.stringify({
      organizationId,
      invoiceId: input.invoiceId,
      action: input.action,
      reason: input.reason.trim(),
      targetInvoiceId: input.targetInvoiceId ?? null,
      invoiceDate: input.invoiceDate ?? null,
      dueDate: input.dueDate ?? null,
    });

    try {
      return await this.repository.transition({
        ...input,
        organizationId,
        actorId,
        reason: input.reason.trim(),
        requestHash: createHash("sha256").update(canonical).digest("hex"),
      });
    } catch (error) {
      if (error instanceof ProjectBillingTransitionError) {
        const status = error.code === "NOT_FOUND" ? 404 : 409;
        throw new ServiceError(error.message, error.code, status);
      }
      throw error;
    }
  }
}
