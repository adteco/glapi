import { NextRequest, NextResponse } from 'next/server';
import { GlReportingService } from '@glapi/api-service';
import { getServiceContext } from '../../../utils/auth';
import { isServiceError } from '../../../utils/errors';

// Force dynamic rendering since this route uses headers
export const dynamic = 'force-dynamic';

// GET /api/gl/reports/trial-balance
export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext();
    const reportingService = new GlReportingService(context);
    
    const searchParams = request.nextUrl.searchParams;
    const periodId = searchParams.get('periodId');
    const subsidiaryId = searchParams.get('subsidiaryId') || undefined;
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const classId = searchParams.get('classId') || undefined;
    const departmentId = searchParams.get('departmentId') || undefined;
    const locationId = searchParams.get('locationId') || undefined;
    
    if (!periodId) {
      return NextResponse.json(
        { message: 'periodId is required' },
        { status: 400 }
      );
    }
    
    const result = await reportingService.getTrialBalance({
      periodId,
      subsidiaryId,
      includeInactive,
      classId,
      departmentId,
      locationId
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error generating trial balance:', error);
    
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