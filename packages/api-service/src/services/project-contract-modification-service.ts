import { createHash } from "node:crypto";
import {
  ProjectContractModificationRepository,
  ProjectContractModificationRepositoryError,
  type ApplyProjectContractModificationInput,
  type ContextualDatabase,
  type ProjectContractModificationReceipt,
  type ProjectContractModificationSource,
} from "@glapi/database";
import {
  calculateProjectContractModification,
  calculateProjectContractRevenueAdjustment,
  generateProjectRevenuePlan,
  ProjectModificationCalculationError,
  ProjectRevenuePlanError,
  recastProjectModificationSchedules,
} from "@glapi/business";
import Decimal from "decimal.js";
import { ServiceError } from "../types";
import { BaseService } from "./base-service";

export interface ProjectContractModificationRequest {
  priorVersionId: string;
  revisedVersionId: string;
  method: "prospective" | "cumulative_catch_up" | "separate_contract";
  effectiveDate: string;
  progressPercentage?: string;
  reason: string;
}

export interface ProjectContractModificationRepositoryLike {
  findReceipt(
    organizationId: string,
    idempotencyKey: string,
  ): Promise<ProjectContractModificationReceipt | null>;
  findSource(
    organizationId: string,
    priorVersionId: string,
    revisedVersionId: string,
  ): Promise<ProjectContractModificationSource | null>;
  apply(
    input: ApplyProjectContractModificationInput,
  ): Promise<ProjectContractModificationReceipt>;
}

export interface ProjectContractModificationServiceOptions {
  db?: ContextualDatabase;
  repository?: ProjectContractModificationRepositoryLike;
}

function canonical(request: ProjectContractModificationRequest) {
  return {
    priorVersionId: request.priorVersionId,
    revisedVersionId: request.revisedVersionId,
    method: request.method,
    effectiveDate: request.effectiveDate,
    progressPercentage: request.progressPercentage ?? null,
    reason: request.reason.trim(),
  };
}

function hash(request: ProjectContractModificationRequest) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(request)))
    .digest("hex");
}

export class ProjectContractModificationService extends BaseService {
  private readonly repository: ProjectContractModificationRepositoryLike;

  constructor(
    context = {},
    options: ProjectContractModificationServiceOptions = {},
  ) {
    super(context);
    this.repository =
      options.repository ??
      new ProjectContractModificationRepository(options.db);
  }

  private async calculate(request: ProjectContractModificationRequest) {
    const organizationId = this.requireOrganizationContext();
    const source = await this.repository.findSource(
      organizationId,
      request.priorVersionId,
      request.revisedVersionId,
    );
    if (!source) {
      throw new ServiceError(
        "The current approved project-contract version and its draft replacement are required",
        "PROJECT_MODIFICATION_NOT_ELIGIBLE",
        409,
      );
    }
    try {
      const fullPlan = generateProjectRevenuePlan({
        projectContractId: source.revisedPlanSource.projectContractId,
        projectContractVersionId:
          source.revisedPlanSource.projectContractVersionId,
        transactionPrice: source.revisedPlanSource.transactionPrice,
        currencyCode: source.revisedPlanSource.currencyCode,
        contractStartDate: source.revisedPlanSource.contractStartDate,
        contractEndDate: source.revisedPlanSource.contractEndDate,
        lines: source.revisedPlanSource.lines,
      });
      const calculation = calculateProjectContractModification({
        method: request.method,
        priorAllocatedAmount: source.priorAllocatedAmount,
        revisedAllocatedAmount: fullPlan.totalAllocated,
        priorRecognizedAmount: source.priorRecognizedAmount,
        progressPercentage: request.progressPercentage,
      });
      const revisedPlan = recastProjectModificationSchedules(
        fullPlan,
        calculation,
        request.effectiveDate,
      );
      const catchUpPosting =
        calculation.catchUpAdjustment === "0.00"
          ? undefined
          : (() => {
              const posting = calculateProjectContractRevenueAdjustment(
                {
                  cumulativeRecognized: new Decimal(
                    source.priorRecognizedAmount,
                  ).toFixed(2),
                  cumulativeBilled: new Decimal(
                    source.priorBilledAmount,
                  ).toFixed(2),
                },
                calculation.catchUpAdjustment,
              );
              const exchangeRate = new Decimal(source.exchangeRate);
              return {
                lines: posting.lines.map((line) => ({
                  ...line,
                  accountRole: line.accountRole as
                    | "contract_asset"
                    | "contract_liability"
                    | "revenue",
                  baseDebitAmount: new Decimal(line.debitAmount)
                    .times(exchangeRate)
                    .toFixed(4),
                  baseCreditAmount: new Decimal(line.creditAmount)
                    .times(exchangeRate)
                    .toFixed(4),
                })),
                totalBaseAmount: new Decimal(posting.totalDebits)
                  .times(exchangeRate)
                  .toFixed(4),
              };
            })();
      return {
        organizationId,
        source,
        calculation,
        revisedPlan,
        catchUpPosting,
      };
    } catch (error) {
      if (
        error instanceof ProjectModificationCalculationError ||
        error instanceof ProjectRevenuePlanError
      ) {
        const code =
          error instanceof ProjectRevenuePlanError
            ? error.code
            : "PROJECT_MODIFICATION_INVALID";
        throw new ServiceError(error.message, code, 422);
      }
      throw error;
    }
  }

  async previewModification(request: ProjectContractModificationRequest) {
    const result = await this.calculate(request);
    return {
      dryRun: true,
      classification: result.calculation.method,
      requiresSeparateContract:
        result.calculation.method === "separate_contract",
      calculation: result.calculation,
      revisedPlan: result.revisedPlan,
    };
  }

  async applyModification(
    request: ProjectContractModificationRequest,
    idempotencyKey: string,
  ) {
    if (!idempotencyKey.trim()) {
      throw new ServiceError(
        "An idempotency key is required for a project-contract modification",
        "PROJECT_MODIFICATION_IDEMPOTENCY_REQUIRED",
        400,
      );
    }
    const organizationId = this.requireOrganizationContext();
    const requestHash = hash(request);
    const existing = await this.repository.findReceipt(
      organizationId,
      idempotencyKey,
    );
    if (existing) {
      if (existing.modification.requestHash !== requestHash) {
        throw new ServiceError(
          "Idempotency key was already used for a different project-contract modification",
          "PROJECT_MODIFICATION_IDEMPOTENCY_CONFLICT",
          409,
        );
      }
      return {
        replayed: true,
        modification: existing.modification,
        supersededScheduleIds: existing.supersededScheduleIds,
      };
    }
    const result = await this.calculate(request);
    try {
      const receipt = await this.repository.apply({
        organizationId: result.organizationId,
        projectContractId: result.source.projectContractId,
        priorVersionId: request.priorVersionId,
        revisedVersionId: request.revisedVersionId,
        effectiveDate: request.effectiveDate,
        ...result.calculation,
        progressPercentage: request.progressPercentage,
        reason: request.reason.trim(),
        idempotencyKey,
        requestHash,
        appliedBy: this.requireUserContext(),
        revisedPlan: {
          organizationId: result.organizationId,
          ...result.revisedPlan,
        },
        catchUpPosting: result.catchUpPosting,
      });
      return {
        replayed: receipt.replayed,
        modification: receipt.modification,
        supersededScheduleIds: receipt.supersededScheduleIds,
      };
    } catch (error) {
      if (!(error instanceof ProjectContractModificationRepositoryError))
        throw error;
      throw new ServiceError(error.message, error.code, 409);
    }
  }
}
