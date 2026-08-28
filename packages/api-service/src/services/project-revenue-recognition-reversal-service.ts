import { createHash } from "node:crypto";
import {
  ProjectRevenueRecognitionReversalError,
  ProjectRevenueRecognitionReversalRepository,
  type ContextualDatabase,
  type ProjectRevenueRecognitionReversalInput,
  type ProjectRevenueRecognitionReversalReceipt,
} from "@glapi/database";
import { ServiceError } from "../types";
import { BaseService } from "./base-service";

export interface ProjectRevenueRecognitionReversalRequest {
  subsidiaryId: string;
  originalRunId: string;
  accountingPeriodId: string;
  reversalDate: string;
  reason: string;
}

export interface ProjectRevenueRecognitionReversalRepositoryLike {
  execute(
    input: ProjectRevenueRecognitionReversalInput,
  ): Promise<ProjectRevenueRecognitionReversalReceipt>;
}

export interface ProjectRevenueRecognitionReversalServiceOptions {
  db?: ContextualDatabase;
  repository?: ProjectRevenueRecognitionReversalRepositoryLike;
}

function canonical(request: ProjectRevenueRecognitionReversalRequest) {
  return { ...request, reason: request.reason.trim() };
}

export class ProjectRevenueRecognitionReversalService extends BaseService {
  private readonly repository: ProjectRevenueRecognitionReversalRepositoryLike;

  constructor(
    context = {},
    options: ProjectRevenueRecognitionReversalServiceOptions = {},
  ) {
    super(context);
    this.repository =
      options.repository ??
      new ProjectRevenueRecognitionReversalRepository(options.db);
  }

  async reverseRun(
    request: ProjectRevenueRecognitionReversalRequest,
    idempotencyKey: string,
  ) {
    if (!idempotencyKey.trim()) {
      throw new ServiceError(
        "An idempotency key is required for a recognition reversal",
        "PROJECT_REVENUE_REVERSAL_IDEMPOTENCY_REQUIRED",
        400,
      );
    }
    const normalized = canonical(request);
    try {
      const receipt = await this.repository.execute({
        organizationId: this.requireOrganizationContext(),
        ...normalized,
        idempotencyKey,
        requestHash: createHash("sha256")
          .update(JSON.stringify(normalized))
          .digest("hex"),
        approvedBy: this.requireUserContext(),
        workerActor: "project-revenue-recognition-reversal-service",
      });
      return {
        replayed: receipt.replayed,
        reversal: receipt.reversal,
        items: receipt.items,
        glTransaction: receipt.glTransaction,
      };
    } catch (error) {
      if (!(error instanceof ProjectRevenueRecognitionReversalError))
        throw error;
      const statusCode =
        error.code === "PROJECT_REVENUE_REVERSAL_PERIOD_NOT_FOUND" ? 404 : 409;
      throw new ServiceError(error.message, error.code, statusCode);
    }
  }
}
