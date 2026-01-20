export interface JobCostSummary {
  projectId: string;
  projectName: string;
  projectCode: string | null;
  subsidiaryId: string | null;
  totalBudgetAmount: string;
  totalCommittedAmount: string;
  totalActualCost: string;
  totalWipClearing: string;
  percentComplete: string;
  lastPostedAt: string | null;
}

export interface JobCostSummaryFilters {
  projectId?: string;
  projectIds?: string[];
  subsidiaryId?: string;
  search?: string;
}

export interface ProjectProgressSnapshot {
  id: string;
  projectId: string;
  snapshotDate: string;
  totalBudgetAmount: string;
  totalCommittedAmount: string;
  totalActualCost: string;
  totalWipClearing: string;
  percentComplete: string;
  sourceGlTransactionId?: string | null;
  createdAt: string;
}

export interface BudgetLineVariance {
  budgetLineId: string;
  costCodeId: string;
  costCode: string;
  costCodeName: string;
  costType: string;
  originalBudgetAmount: string;
  revisedBudgetAmount: string;
  committedAmount: string;
  actualAmount: string;
  encumberedAmount: string;
  varianceAmount: string;
  variancePercent: string;
  estimateToComplete: string;
  estimateAtCompletion: string;
}

export interface CostTypeVarianceSummary {
  costType: string;
  totalBudget: string;
  totalActual: string;
  totalCommitted: string;
  totalVariance: string;
  variancePercent: string;
}

export interface BudgetVarianceReport {
  projectId: string;
  projectName: string;
  projectCode: string | null;
  budgetVersionId: string;
  budgetVersionName: string;
  asOfDate: string;
  summary: {
    totalBudgetAmount: string;
    totalCommittedAmount: string;
    totalActualAmount: string;
    totalVarianceAmount: string;
    variancePercent: string;
    percentComplete: string;
  };
  byLine: BudgetLineVariance[];
  byCostType: CostTypeVarianceSummary[];
}

export interface BudgetVarianceFilters {
  projectId: string;
  budgetVersionId?: string;
  costType?: string;
}
