import { NextRequest, NextResponse } from 'next/server';
import { createStatementQueryBuilder } from '@glapi/api-service';
import { getServiceContext } from '../../../../utils/auth';
import { isServiceError } from '../../../../utils/errors';

// Force dynamic rendering since this route uses headers
export const dynamic = 'force-dynamic';

// GET /api/gl/reports/trial-balance/export
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

    const data = await builder.getTrialBalance();

    if (format === 'json') {
      return NextResponse.json(data);
    }

    // Generate CSV
    const csv = generateTrialBalanceCSV(data);

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="trial-balance-${periodId}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting trial balance:', error);

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

function generateTrialBalanceCSV(
  data: Awaited<ReturnType<ReturnType<typeof createStatementQueryBuilder>['getTrialBalance']>>
): string {
  const lines: string[] = [];

  lines.push('Trial Balance');
  lines.push(`Period: ${escapeCSV(data.periodName)}`);
  lines.push(`Subsidiary: ${escapeCSV(data.subsidiaryName)}`);
  lines.push(`As of Date: ${escapeCSV(data.asOfDate)}`);
  lines.push('');

  lines.push('Account Number,Account Name,Category,Debit Balance,Credit Balance,Net Balance');

  const allAccounts = [
    ...data.assetAccounts,
    ...data.liabilityAccounts,
    ...data.equityAccounts,
    ...data.revenueAccounts,
    ...data.cogsAccounts,
    ...data.expenseAccounts,
  ].sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

  for (const account of allAccounts) {
    lines.push(
      [
        escapeCSV(account.accountNumber),
        escapeCSV(account.accountName),
        escapeCSV(account.accountCategory),
        formatCurrency(account.debitBalance),
        formatCurrency(account.creditBalance),
        formatCurrency(account.netBalance),
      ].join(',')
    );
  }

  lines.push('');
  lines.push(
    `TOTALS,,,${formatCurrency(data.totals.totalDebits)},${formatCurrency(data.totals.totalCredits)},${formatCurrency(data.totals.difference)}`
  );

  return lines.join('\n');
}
