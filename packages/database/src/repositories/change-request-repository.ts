import { and, desc, eq } from 'drizzle-orm';
import {
  changeRequests,
  type ChangeRequestRecord,
  type NewChangeRequestRecord,
  changeRequestStatusEnum,
} from '../db/schema/audit-logs';
import { BaseRepository } from './base-repository';

export class ChangeRequestRepository extends BaseRepository {
  async create(data: NewChangeRequestRecord): Promise<ChangeRequestRecord> {
    const [record] = await this.db.insert(changeRequests).values(data).returning();
    return record;
  }

  async findById(id: string): Promise<ChangeRequestRecord | null> {
    const [record] = await this.db
      .select()
      .from(changeRequests)
      .where(eq(changeRequests.id, id))
      .limit(1);
    return record || null;
  }

  async listByOrganization(
    organizationId: string,
    status?: (typeof changeRequestStatusEnum.enumValues)[number],
  ): Promise<ChangeRequestRecord[]> {
    const conditions = [eq(changeRequests.organizationId, organizationId)];
    if (status) {
      conditions.push(eq(changeRequests.status, status));
    }

    return this.db
      .select()
      .from(changeRequests)
      .where(and(...conditions))
      .orderBy(desc(changeRequests.createdAt));
  }

  async update(
    id: string,
    data: Partial<NewChangeRequestRecord>,
  ): Promise<ChangeRequestRecord | null> {
    const [record] = await this.db
      .update(changeRequests)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(changeRequests.id, id))
      .returning();

    return record || null;
  }
}
