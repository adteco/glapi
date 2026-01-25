import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import { db } from '../index';
import { accountingPeriods } from '../db/schema/accounting-periods';
import { subsidiaries } from '../db/schema/subsidiaries';
import { eq, and } from 'drizzle-orm';

// Test the fixed fiscal year period generation logic
function generateFiscalYearPeriods(yearStartDate: string, fiscalYear: string) {
  const [startYear, startMonth, startDay] = yearStartDate.split('-').map(Number);
  const periods: Array<{
    periodName: string;
    periodNumber: number;
    startDate: string;
    endDate: string;
  }> = [];

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  for (let i = 0; i < 12; i++) {
    const monthIndex = (startMonth - 1 + i) % 12;
    const yearOffset = Math.floor((startMonth - 1 + i) / 12);
    const periodYear = startYear + yearOffset;

    const periodStartDate = new Date(Date.UTC(periodYear, monthIndex, 1));
    const nextMonthIndex = (monthIndex + 1) % 12;
    const nextYearOffset = monthIndex === 11 ? 1 : 0;
    const periodEndDate = new Date(Date.UTC(periodYear + nextYearOffset, nextMonthIndex, 0));

    periods.push({
      periodName: `${monthNames[monthIndex]} ${periodYear}`,
      periodNumber: i + 1,
      startDate: periodStartDate.toISOString().split('T')[0],
      endDate: periodEndDate.toISOString().split('T')[0],
    });
  }

  return periods;
}

async function testAccountingPeriodInsert() {
  console.log('Testing fiscal year period generation...\n');

  // Test the logic first (no DB)
  const periods = generateFiscalYearPeriods('2026-01-01', '2026');

  console.log('Generated periods:');
  periods.forEach((p, i) => {
    console.log(`  ${p.periodNumber}. ${p.periodName}: ${p.startDate} to ${p.endDate}`);
  });

  // Validate
  let errors = 0;

  // Check Period 1 is January 2026
  if (periods[0].periodName !== 'January 2026') {
    console.error(`\n❌ ERROR: Period 1 should be "January 2026", got "${periods[0].periodName}"`);
    errors++;
  }
  if (periods[0].startDate !== '2026-01-01') {
    console.error(`\n❌ ERROR: Period 1 start should be "2026-01-01", got "${periods[0].startDate}"`);
    errors++;
  }
  if (periods[0].endDate !== '2026-01-31') {
    console.error(`\n❌ ERROR: Period 1 end should be "2026-01-31", got "${periods[0].endDate}"`);
    errors++;
  }

  // Check Period 2 is February 2026
  if (periods[1].periodName !== 'February 2026') {
    console.error(`\n❌ ERROR: Period 2 should be "February 2026", got "${periods[1].periodName}"`);
    errors++;
  }
  if (periods[1].startDate !== '2026-02-01') {
    console.error(`\n❌ ERROR: Period 2 start should be "2026-02-01", got "${periods[1].startDate}"`);
    errors++;
  }
  if (periods[1].endDate !== '2026-02-28') {
    console.error(`\n❌ ERROR: Period 2 end should be "2026-02-28", got "${periods[1].endDate}"`);
    errors++;
  }

  // Check Period 12 is December 2026
  if (periods[11].periodName !== 'December 2026') {
    console.error(`\n❌ ERROR: Period 12 should be "December 2026", got "${periods[11].periodName}"`);
    errors++;
  }
  if (periods[11].startDate !== '2026-12-01') {
    console.error(`\n❌ ERROR: Period 12 start should be "2026-12-01", got "${periods[11].startDate}"`);
    errors++;
  }
  if (periods[11].endDate !== '2026-12-31') {
    console.error(`\n❌ ERROR: Period 12 end should be "2026-12-31", got "${periods[11].endDate}"`);
    errors++;
  }

  if (errors === 0) {
    console.log('\n✅ All period calculations are correct!');
  } else {
    console.error(`\n❌ ${errors} errors found`);
    process.exit(1);
  }

  // Now test actual DB insert
  console.log('\n--- Testing DB insert ---');

  try {
    const subs = await db.select().from(subsidiaries).limit(1);
    if (subs.length === 0) {
      console.error('ERROR: No subsidiaries found in database');
      process.exit(1);
    }

    const subsidiaryId = subs[0].id;
    const organizationId = subs[0].organizationId;
    const testPeriod = {
      organizationId,
      subsidiaryId,
      periodName: 'January 2026',
      fiscalYear: '2026',
      periodNumber: 1,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      periodType: 'MONTH',
      status: 'OPEN',
      isAdjustmentPeriod: false,
      createdDate: new Date(),
    };

    const [inserted] = await db
      .insert(accountingPeriods)
      .values(testPeriod)
      .returning();

    console.log('✅ DB insert successful:', inserted.periodName);

    // Clean up
    await db.delete(accountingPeriods).where(eq(accountingPeriods.id, inserted.id));
    console.log('🧹 Cleaned up test data');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ DB test FAILED:', error);
    process.exit(1);
  }
}

testAccountingPeriodInsert();
