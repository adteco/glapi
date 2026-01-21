import { eq, and, desc, sql, gte, lte, inArray, isNull, lt } from 'drizzle-orm';
import { db } from '../db';
import {
  billingSchedules,
  billingScheduleLines,
  type BillingSchedule,
  type NewBillingSchedule,
  type UpdateBillingSchedule,
  type BillingScheduleLine,
  type NewBillingScheduleLine,
  type UpdateBillingScheduleLine,
  type BillingScheduleWithLines,
} from '../db/schema/billing-schedules';

export class BillingScheduleRepository {
  // ============================================================================
  // Schedule CRUD Operations
  // ============================================================================

  async create(data: NewBillingSchedule): Promise<BillingSchedule> {
    const [schedule] = await db
      .insert(billingSchedules)
      .values(data)
      .returning();
    return schedule;
  }

  async createWithLines(
    scheduleData: NewBillingSchedule,
    linesData: Omit<NewBillingScheduleLine, 'billingScheduleId'>[]
  ): Promise<BillingScheduleWithLines> {
    return await db.transaction(async (tx) => {
      // Create the billing schedule
      const [schedule] = await tx
        .insert(billingSchedules)
        .values(scheduleData)
        .returning();

      // Create all billing schedule lines
      const lines: BillingScheduleLine[] = [];
      if (linesData.length > 0) {
        const linesWithScheduleId = linesData.map(line => ({
          ...line,
          billingScheduleId: schedule.id,
        }));

        const createdLines = await tx
          .insert(billingScheduleLines)
          .values(linesWithScheduleId)
          .returning();

        lines.push(...createdLines);
      }

      // Update the schedule with totals
      const totalScheduledAmount = lines.reduce((sum, line) =>
        sum + parseFloat(line.expectedAmount || '0'), 0
      );

      const [updatedSchedule] = await tx
        .update(billingSchedules)
        .set({
          totalScheduledAmount: totalScheduledAmount.toFixed(2),
          totalLines: lines.length,
        })
        .where(eq(billingSchedules.id, schedule.id))
        .returning();

      return {
        ...updatedSchedule,
        lines,
      };
    });
  }

  async findById(id: string): Promise<BillingSchedule | null> {
    const [schedule] = await db
      .select()
      .from(billingSchedules)
      .where(eq(billingSchedules.id, id))
      .limit(1);
    return schedule || null;
  }

  async findByIdWithLines(id: string): Promise<BillingScheduleWithLines | null> {
    const schedule = await this.findById(id);
    if (!schedule) return null;

    const lines = await db
      .select()
      .from(billingScheduleLines)
      .where(eq(billingScheduleLines.billingScheduleId, id))
      .orderBy(billingScheduleLines.sequenceNumber);

    return {
      ...schedule,
      lines,
    };
  }

  async findBySubscriptionId(subscriptionId: string): Promise<BillingSchedule[]> {
    return await db
      .select()
      .from(billingSchedules)
      .where(eq(billingSchedules.subscriptionId, subscriptionId))
      .orderBy(desc(billingSchedules.createdAt));
  }

  async findActiveBySubscriptionId(subscriptionId: string): Promise<BillingSchedule | null> {
    const [schedule] = await db
      .select()
      .from(billingSchedules)
      .where(
        and(
          eq(billingSchedules.subscriptionId, subscriptionId),
          eq(billingSchedules.status, 'active')
        )
      )
      .orderBy(desc(billingSchedules.createdAt))
      .limit(1);
    return schedule || null;
  }

  async update(id: string, data: UpdateBillingSchedule): Promise<BillingSchedule | null> {
    const [updated] = await db
      .update(billingSchedules)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(billingSchedules.id, id))
      .returning();
    return updated || null;
  }

  async delete(id: string): Promise<void> {
    await db.delete(billingSchedules).where(eq(billingSchedules.id, id));
  }

  // ============================================================================
  // Schedule Line Operations
  // ============================================================================

  async createLine(data: NewBillingScheduleLine): Promise<BillingScheduleLine> {
    const [line] = await db
      .insert(billingScheduleLines)
      .values(data)
      .returning();
    return line;
  }

  async createLines(lines: NewBillingScheduleLine[]): Promise<BillingScheduleLine[]> {
    if (lines.length === 0) return [];

    return await db
      .insert(billingScheduleLines)
      .values(lines)
      .returning();
  }

  async findLineById(id: string): Promise<BillingScheduleLine | null> {
    const [line] = await db
      .select()
      .from(billingScheduleLines)
      .where(eq(billingScheduleLines.id, id))
      .limit(1);
    return line || null;
  }

  async findLinesByScheduleId(scheduleId: string): Promise<BillingScheduleLine[]> {
    return await db
      .select()
      .from(billingScheduleLines)
      .where(eq(billingScheduleLines.billingScheduleId, scheduleId))
      .orderBy(billingScheduleLines.sequenceNumber);
  }

  async updateLine(id: string, data: UpdateBillingScheduleLine): Promise<BillingScheduleLine | null> {
    const [updated] = await db
      .update(billingScheduleLines)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(billingScheduleLines.id, id))
      .returning();
    return updated || null;
  }

  async deleteLine(id: string): Promise<void> {
    await db.delete(billingScheduleLines).where(eq(billingScheduleLines.id, id));
  }

  async deleteLinesByScheduleId(scheduleId: string): Promise<void> {
    await db.delete(billingScheduleLines).where(eq(billingScheduleLines.billingScheduleId, scheduleId));
  }

  // ============================================================================
  // Query Operations
  // ============================================================================

  async list(options: {
    organizationId: string;
    subscriptionId?: string;
    status?: string | string[];
    limit?: number;
    offset?: number;
  }): Promise<{ data: BillingSchedule[]; total: number }> {
    const { organizationId, subscriptionId, status, limit = 50, offset = 0 } = options;

    const conditions = [eq(billingSchedules.organizationId, organizationId)];

    if (subscriptionId) {
      conditions.push(eq(billingSchedules.subscriptionId, subscriptionId));
    }

    if (status) {
      if (Array.isArray(status)) {
        conditions.push(inArray(billingSchedules.status, status as any));
      } else {
        conditions.push(eq(billingSchedules.status, status as any));
      }
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(billingSchedules)
      .where(whereClause);

    const data = await db
      .select()
      .from(billingSchedules)
      .where(whereClause)
      .orderBy(desc(billingSchedules.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data,
      total: countResult?.count || 0,
    };
  }

  // ============================================================================
  // Billing Due Query Operations
  // ============================================================================

  async findLinesDueToBill(
    organizationId: string,
    asOfDate: Date
  ): Promise<BillingScheduleLine[]> {
    const dateStr = asOfDate.toISOString().split('T')[0];

    return await db
      .select()
      .from(billingScheduleLines)
      .where(
        and(
          eq(billingScheduleLines.organizationId, organizationId),
          eq(billingScheduleLines.status, 'scheduled'),
          lte(billingScheduleLines.scheduledBillingDate, dateStr),
          isNull(billingScheduleLines.invoiceId)
        )
      )
      .orderBy(
        billingScheduleLines.scheduledBillingDate,
        billingScheduleLines.sequenceNumber
      );
  }

  async findOverdueLines(
    organizationId: string,
    asOfDate: Date
  ): Promise<BillingScheduleLine[]> {
    const dateStr = asOfDate.toISOString().split('T')[0];

    return await db
      .select()
      .from(billingScheduleLines)
      .where(
        and(
          eq(billingScheduleLines.organizationId, organizationId),
          inArray(billingScheduleLines.status, ['scheduled', 'invoiced']),
          lt(billingScheduleLines.dueDate, dateStr)
        )
      )
      .orderBy(billingScheduleLines.dueDate);
  }

  // ============================================================================
  // Invoice Linking
  // ============================================================================

  async markLineAsInvoiced(
    lineId: string,
    invoiceId: string,
    invoicedAmount: string
  ): Promise<BillingScheduleLine | null> {
    return await db.transaction(async (tx) => {
      const [line] = await tx
        .update(billingScheduleLines)
        .set({
          invoiceId,
          invoicedDate: new Date().toISOString().split('T')[0],
          invoicedAmount,
          status: 'invoiced',
          updatedAt: new Date(),
        })
        .where(eq(billingScheduleLines.id, lineId))
        .returning();

      if (!line) return null;

      // Update schedule totals
      await this.recalculateScheduleTotals(tx, line.billingScheduleId);

      return line;
    });
  }

  async markLineAsPaid(lineId: string): Promise<BillingScheduleLine | null> {
    return await db.transaction(async (tx) => {
      const [line] = await tx
        .update(billingScheduleLines)
        .set({
          status: 'paid',
          updatedAt: new Date(),
        })
        .where(eq(billingScheduleLines.id, lineId))
        .returning();

      if (!line) return null;

      // Update schedule totals
      await this.recalculateScheduleTotals(tx, line.billingScheduleId);

      return line;
    });
  }

  async markLineAsCancelled(lineId: string, reason?: string): Promise<BillingScheduleLine | null> {
    return await db.transaction(async (tx) => {
      const [line] = await tx
        .update(billingScheduleLines)
        .set({
          status: 'cancelled',
          notes: reason,
          updatedAt: new Date(),
        })
        .where(eq(billingScheduleLines.id, lineId))
        .returning();

      if (!line) return null;

      // Update schedule totals
      await this.recalculateScheduleTotals(tx, line.billingScheduleId);

      return line;
    });
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async recalculateScheduleTotals(tx: any, scheduleId: string): Promise<void> {
    const lines = await tx
      .select()
      .from(billingScheduleLines)
      .where(eq(billingScheduleLines.billingScheduleId, scheduleId));

    const totalScheduled = lines.reduce((sum: number, line: BillingScheduleLine) =>
      sum + parseFloat(line.expectedAmount || '0'), 0
    );

    const totalInvoiced = lines.reduce((sum: number, line: BillingScheduleLine) =>
      sum + parseFloat(line.invoicedAmount || '0'), 0
    );

    const invoicedLines = lines.filter((l: BillingScheduleLine) =>
      l.status === 'invoiced' || l.status === 'paid'
    ).length;

    const paidLines = lines.filter((l: BillingScheduleLine) =>
      l.status === 'paid'
    ).length;

    // Find next billing date from scheduled lines
    const scheduledLines = lines.filter((l: BillingScheduleLine) => l.status === 'scheduled');
    const nextBillingDate = scheduledLines.length > 0
      ? scheduledLines.reduce((min: string | null, l: BillingScheduleLine) =>
          !min || l.scheduledBillingDate < min ? l.scheduledBillingDate : min
        , null)
      : null;

    // Find last billed date and amount
    const invoicedLinesSorted = lines
      .filter((l: BillingScheduleLine) => l.invoicedDate)
      .sort((a: BillingScheduleLine, b: BillingScheduleLine) =>
        (b.invoicedDate || '').localeCompare(a.invoicedDate || '')
      );

    const lastBilledDate = invoicedLinesSorted.length > 0
      ? invoicedLinesSorted[0].invoicedDate
      : null;

    const lastBilledAmount = invoicedLinesSorted.length > 0
      ? invoicedLinesSorted[0].invoicedAmount
      : null;

    await tx
      .update(billingSchedules)
      .set({
        totalScheduledAmount: totalScheduled.toFixed(2),
        totalInvoicedAmount: totalInvoiced.toFixed(2),
        totalLines: lines.length,
        invoicedLines,
        paidLines,
        nextBillingDate,
        lastBilledDate,
        lastBilledAmount,
        updatedAt: new Date(),
      })
      .where(eq(billingSchedules.id, scheduleId));
  }

  async generateScheduleNumber(organizationId: string): Promise<string> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(billingSchedules)
      .where(eq(billingSchedules.organizationId, organizationId));

    const sequence = (result?.count || 0) + 1;
    return `SCHED-${sequence.toString().padStart(6, '0')}`;
  }

  async getNextSequenceNumber(scheduleId: string): Promise<number> {
    const [result] = await db
      .select({ maxSeq: sql<number>`COALESCE(MAX(${billingScheduleLines.sequenceNumber}), 0)::int` })
      .from(billingScheduleLines)
      .where(eq(billingScheduleLines.billingScheduleId, scheduleId));

    return (result?.maxSeq || 0) + 1;
  }
}
