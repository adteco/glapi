import { and, desc, eq } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  projectProgressSnapshots,
  type NewProjectProgressSnapshot,
  type ProjectProgressSnapshot,
} from '../db/schema/project-progress';

export class ProjectProgressSnapshotRepository extends BaseRepository {
  async createSnapshots(rows: NewProjectProgressSnapshot[]): Promise<void> {
    if (!rows.length) return;
    await this.db.insert(projectProgressSnapshots).values(rows);
  }

  async listByProject(projectId: string, organizationId: string, limit = 12): Promise<ProjectProgressSnapshot[]> {
    const rows = await this.db
      .select()
      .from(projectProgressSnapshots)
      .where(
        and(
          eq(projectProgressSnapshots.projectId, projectId),
          eq(projectProgressSnapshots.organizationId, organizationId)
        )
      )
      .orderBy(desc(projectProgressSnapshots.snapshotDate), desc(projectProgressSnapshots.createdAt))
      .limit(limit);

    return rows;
  }
}
