import { NextRequest, NextResponse } from 'next/server';
import { FinancialStatementsService } from '@glapi/api-service';
import { getServiceContext } from '../../../utils/auth';
import { isServiceError } from '../../../utils/errors';

// Force dynamic rendering since this route uses headers
export const dynamic = 'force-dynamic';

// GET /api/gl/reports/balance-sheet
export async function GET(request: NextRequest) {
  try {
    const context = await getServiceContext();
    const financialService = new FinancialStatementsService(context);

    const searchParams = request.nextUrl.searchParams;
    const periodId = searchParams.get('periodId');
    const subsidiaryId = searchParams.get('subsidiaryId') || undefined;
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const classId = searchParams.get('classId') || undefined;
    const departmentId = searchParams.get('departmentId') || undefined;
    const locationId = searchParams.get('locationId') || undefined;
    const comparePeriodId = searchParams.get('comparePeriodId') || undefined;

    if (!periodId) {
      return NextResponse.json(
        { message: 'periodId is required' },
        { status: 400 }
      );
    }

    const result = await financialService.generateBalanceSheet({
      organizationId: context.organizationId!,
      periodId,
      subsidiaryId,
      includeInactive,
      classId,
      departmentId,
      locationId,
      includeComparison: !!comparePeriodId,
      comparePeriodId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error generating balance sheet:', error);

    if (isServiceError(error)) {
      return NextResponse.json(
        {
          message: error.message,
          code: error.code,
          details: error.details
        },
        { status: error.statusCode }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
