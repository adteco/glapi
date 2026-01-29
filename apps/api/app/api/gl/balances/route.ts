import { NextRequest, NextResponse } from 'next/server';
import { GlBalanceService } from '@glapi/api-service';
import { getServiceContext } from '../../utils/auth';
import { isServiceError } from '../../utils/errors';

// Force dynamic rendering since this route uses headers
export const dynamic = 'force-dynamic';

/**
 * GET /api/gl/balances
 *
 * Get account balances from the projection system (fast, pre-calculated).
 *
 * Query parameters:
 * - accountId: string (optional) - Filter by specific account
 * - periodId: string (required) - The accounting period
 * - subsidiaryId: string (optional) - Filter by subsidiary
 * - currencyCode: string (optional) - Filter by currency
 *
 * For ad-hoc balance calculations from transactions, use /api/gl/reports/trial-balance instead.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getServiceContext();
    const balanceService = new GlBalanceService(context);

    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get('accountId') || undefined;
    const periodId = searchParams.get('periodId');
    const subsidiaryId = searchParams.get('subsidiaryId') || undefined;
    const currencyCode = searchParams.get('currencyCode') || undefined;

    if (!periodId) {
      return NextResponse.json(
        { message: 'periodId is required' },
        { status: 400 }
      );
    }

    // If accountId is provided, get single account balance
    if (accountId) {
      const balance = await balanceService.getAccountBalance({
        accountId,
        periodId,
        subsidiaryId,
        currencyCode,
      });

      if (!balance) {
        return NextResponse.json(
          { message: 'Balance not found for the specified criteria' },
          { status: 404 }
        );
      }

      return NextResponse.json(balance);
    }

    // Otherwise, get all balances for the period
    const balances = await balanceService.getAccountBalances({
      periodId,
      subsidiaryId,
      currencyCode,
    });

    return NextResponse.json({
      data: balances,
      total: balances.length,
      periodId,
      subsidiaryId,
      currencyCode,
    });
  } catch (error) {
    console.error('Error getting account balances:', error);

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
