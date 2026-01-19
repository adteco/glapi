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
  subsidiaryId?: string;
  search?: string;
}
