import { NextRequest, NextResponse } from 'next/server';
import { GlBalanceService } from '@glapi/api-service';
import { getServiceContext } from '../../../utils/auth';
import { isServiceError } from '../../../utils/errors';

// Force dynamic rendering since this route uses headers
export const dynamic = 'force-dynamic';

/**
 * GET /api/gl/balances/trial-balance
 *
 * Get trial balance from pre-calculated projections (fast).
 *
 * Query parameters:
 * - periodId: string (required) - The accounting period
 * - subsidiaryId: string (optional) - Filter by subsidiary
 * - currencyCode: string (optional) - Filter by currency
 *
 * Returns aggregated debit/credit balances by account with totals.
 *
 * For ad-hoc trial balance with dimension filtering, use /api/gl/reports/trial-balance instead.
 */
export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext();
    const balanceService = new GlBalanceService(context);

    const searchParams = request.nextUrl.searchParams;
    const periodId = searchParams.get('periodId');
    const subsidiaryId = searchParams.get('subsidiaryId') || undefined;
    const currencyCode = searchParams.get('currencyCode') || undefined;

    if (!periodId) {
      return NextResponse.json(
        { message: 'periodId is required' },
        { status: 400 }
      );
    }

    const result = await balanceService.getTrialBalance(
      periodId,
      subsidiaryId,
      currencyCode
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error generating trial balance from projections:', error);

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
