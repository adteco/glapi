import { BaseService } from './base-service';
import { JobCostSummary, JobCostSummaryFilters } from '../types';
import { ProjectReportingRepository } from '@glapi/database';

export class ProjectReportingService extends BaseService {
  private repository: ProjectReportingRepository;

  constructor(context = {}) {
    super(context);
    this.repository = new ProjectReportingRepository();
  }

  async listJobCostSummary(filters: JobCostSummaryFilters = {}): Promise<JobCostSummary[]> {
    const organizationId = this.requireOrganizationContext();
    const rows = await this.repository.getJobCostSummary(organizationId, filters);

    return rows.map((row) => ({
      projectId: row.projectId,
      projectName: row.projectName,
      projectCode: row.projectCode,
      subsidiaryId: row.subsidiaryId,
      totalBudgetAmount: row.totalBudgetAmount ?? '0',
      totalCommittedAmount: row.totalCommittedAmount ?? '0',
      totalActualCost: row.totalActualCost ?? '0',
      totalWipClearing: row.totalWipClearing ?? '0',
      percentComplete: row.percentComplete ?? '0',
      lastPostedAt: row.lastPostedAt,
    }));
  }
}
