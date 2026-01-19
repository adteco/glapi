import { NextRequest, NextResponse } from 'next/server';
import { createStatementQueryBuilder } from '@glapi/api-service';
import { getServiceContext } from '../../../../utils/auth';
import { isServiceError } from '../../../../utils/errors';

// Force dynamic rendering since this route uses headers
export const dynamic = 'force-dynamic';

// GET /api/gl/reports/balance-sheet/export
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

    const data = await builder.getBalanceSheet();

    if (format === 'json') {
      return NextResponse.json(data);
    }

    // Generate CSV
    const csv = generateBalanceSheetCSV(data);

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="balance-sheet-${periodId}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting balance sheet:', error);

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

function generateBalanceSheetCSV(
  data: Awaited<ReturnType<ReturnType<typeof createStatementQueryBuilder>['getBalanceSheet']>>
): string {
  const lines: string[] = [];

  lines.push('Balance Sheet');
  lines.push(`Period: ${escapeCSV(data.periodName)}`);
  lines.push(`Subsidiary: ${escapeCSV(data.subsidiaryName)}`);
  lines.push(`As of Date: ${escapeCSV(data.asOfDate)}`);
  lines.push('');

  lines.push('Description,Amount');

  // Assets
  lines.push('ASSETS,');
  lines.push('Current Assets,');
  for (const item of data.currentAssetsSection.lineItems) {
    lines.push(
      `  ${escapeCSV(item.accountName)},${formatCurrency(item.currentPeriodAmount)}`
    );
  }
  lines.push(`Total Current Assets,${formatCurrency(data.totalCurrentAssets)}`);
  lines.push('');

  lines.push('Non-Current Assets,');
  for (const item of data.nonCurrentAssetsSection.lineItems) {
    lines.push(
      `  ${escapeCSV(item.accountName)},${formatCurrency(item.currentPeriodAmount)}`
    );
  }
  lines.push(
    `Total Non-Current Assets,${formatCurrency(data.totalNonCurrentAssets)}`
  );
  lines.push('');
  lines.push(`TOTAL ASSETS,${formatCurrency(data.totalAssets)}`);
  lines.push('');

  // Liabilities
  lines.push('LIABILITIES,');
  lines.push('Current Liabilities,');
  for (const item of data.currentLiabilitiesSection.lineItems) {
    lines.push(
      `  ${escapeCSV(item.accountName)},${formatCurrency(item.currentPeriodAmount)}`
    );
  }
  lines.push(
    `Total Current Liabilities,${formatCurrency(data.totalCurrentLiabilities)}`
  );
  lines.push('');

  lines.push('Long-Term Liabilities,');
  for (const item of data.longTermLiabilitiesSection.lineItems) {
    lines.push(
      `  ${escapeCSV(item.accountName)},${formatCurrency(item.currentPeriodAmount)}`
    );
  }
  lines.push(
    `Total Long-Term Liabilities,${formatCurrency(data.totalLongTermLiabilities)}`
  );
  lines.push('');
  lines.push(`TOTAL LIABILITIES,${formatCurrency(data.totalLiabilities)}`);
  lines.push('');

  // Equity
  lines.push('EQUITY,');
  for (const item of data.equitySection.lineItems) {
    lines.push(
      `  ${escapeCSV(item.accountName)},${formatCurrency(item.currentPeriodAmount)}`
    );
  }
  lines.push(`Retained Earnings,${formatCurrency(data.retainedEarnings)}`);
  lines.push(
    `Current Period Net Income,${formatCurrency(data.currentPeriodNetIncome)}`
  );
  lines.push(`TOTAL EQUITY,${formatCurrency(data.totalEquity)}`);
  lines.push('');

  // Balance check
  lines.push(
    `TOTAL LIABILITIES & EQUITY,${formatCurrency(data.totalLiabilitiesAndEquity)}`
  );
  lines.push('');
  if (data.balanceCheck !== 0) {
    lines.push(
      `Balance Check (should be 0),${formatCurrency(data.balanceCheck)}`
    );
  }

  return lines.join('\n');
}
