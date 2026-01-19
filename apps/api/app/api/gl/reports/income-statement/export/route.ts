import { NextRequest, NextResponse } from 'next/server';
import { createStatementQueryBuilder } from '@glapi/api-service';
import { getServiceContext } from '../../../../utils/auth';
import { isServiceError } from '../../../../utils/errors';

// Force dynamic rendering since this route uses headers
export const dynamic = 'force-dynamic';

// GET /api/gl/reports/income-statement/export
export async function GET(request: NextRequest) {
  try {
    const context = await getServiceContext();
    const organizationId = context.organizationId!;

    const searchParams = request.nextUrl.searchParams;
    const periodId = searchParams.get('periodId');
    const subsidiaryId = searchParams.get('subsidiaryId') || undefined;
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const classId = searchParams.get('classId') || undefined;
    const departmentId = searchParams.get('departmentId') || undefined;
    const locationId = searchParams.get('locationId') || undefined;
    const comparePeriodId = searchParams.get('comparePeriodId') || undefined;
    const format = searchParams.get('format') || 'csv';

    if (!periodId) {
      return NextResponse.json(
        { message: 'periodId is required' },
        { status: 400 }
      );
    }

    if (format !== 'csv' && format !== 'json') {
      return NextResponse.json(
        { message: 'format must be "csv" or "json"' },
        { status: 400 }
      );
    }

    const builder = createStatementQueryBuilder(organizationId)
      .forPeriod(periodId)
      .withSubsidiary(subsidiaryId ?? null)
      .withSegments({
        classId: classId ?? null,
        departmentId: departmentId ?? null,
        locationId: locationId ?? null,
      })
      .withInactiveAccounts(includeInactive);

    if (comparePeriodId) {
      builder.compareTo(comparePeriodId);
    }

    const data = await builder.getIncomeStatement();

    if (format === 'json') {
      return NextResponse.json(data);
    }

    // Generate CSV
    const csv = generateIncomeStatementCSV(data);

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="income-statement-${periodId}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting income statement:', error);

    if (isServiceError(error)) {
      return NextResponse.json(
        {
          message: error.message,
          code: error.code,
          details: error.details,
        },
        { status: error.statusCode }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

function formatCurrency(value: number): string {
  if (value < 0) {
    return `(${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeCSV(value: string | number | undefined): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateIncomeStatementCSV(
  data: Awaited<ReturnType<ReturnType<typeof createStatementQueryBuilder>['getIncomeStatement']>>
): string {
  const lines: string[] = [];

  lines.push('Income Statement');
  lines.push(`Period: ${escapeCSV(data.periodName)}`);
  lines.push(`Subsidiary: ${escapeCSV(data.subsidiaryName)}`);
  lines.push(`As of Date: ${escapeCSV(data.asOfDate)}`);
  lines.push('');

  lines.push('Description,Current Period,YTD');

  // Revenue section
  lines.push('REVENUE,,');
  for (const item of data.revenueSection.lineItems) {
    lines.push(
      [
        `  ${escapeCSV(item.accountName)}`,
        formatCurrency(item.currentPeriodAmount),
        formatCurrency(item.ytdAmount),
      ].join(',')
    );
  }
  lines.push(
    `Total Revenue,${formatCurrency(data.revenueSection.sectionTotal)},${formatCurrency(data.totalRevenue)}`
  );
  lines.push('');

  // COGS section
  lines.push('COST OF GOODS SOLD,,');
  for (const item of data.cogsSection.lineItems) {
    lines.push(
      [
        `  ${escapeCSV(item.accountName)}`,
        formatCurrency(item.currentPeriodAmount),
        formatCurrency(item.ytdAmount),
      ].join(',')
    );
  }
  lines.push(
    `Total COGS,${formatCurrency(data.cogsSection.sectionTotal)},${formatCurrency(data.totalCogs)}`
  );
  lines.push('');

  // Gross Profit
  lines.push(`GROSS PROFIT,${formatCurrency(data.grossProfit)},`);
  lines.push(`Gross Profit Margin,${data.grossProfitMargin.toFixed(1)}%,`);
  lines.push('');

  // Operating Expenses section
  lines.push('OPERATING EXPENSES,,');
  for (const item of data.operatingExpensesSection.lineItems) {
    lines.push(
      [
        `  ${escapeCSV(item.accountName)}`,
        formatCurrency(item.currentPeriodAmount),
        formatCurrency(item.ytdAmount),
      ].join(',')
    );
  }
  lines.push(
    `Total Operating Expenses,${formatCurrency(data.operatingExpensesSection.sectionTotal)},${formatCurrency(data.totalOperatingExpenses)}`
  );
  lines.push('');

  // Operating Income & Net Income
  lines.push(`OPERATING INCOME,${formatCurrency(data.operatingIncome)},`);
  lines.push(`Operating Margin,${data.operatingMargin.toFixed(1)}%,`);
  lines.push('');
  lines.push(`NET INCOME,${formatCurrency(data.netIncome)},`);
  lines.push(`Net Profit Margin,${data.netProfitMargin.toFixed(1)}%,`);

  return lines.join('\n');
}
