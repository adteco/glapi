import { NextRequest, NextResponse } from 'next/server';
import { GlReportingService } from '@glapi/api-service';
import { getServiceContext } from '../../../utils/auth';

// GET /api/gl/reports/trial-balance
export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext();
    const reportingService = new GlReportingService(context);
    
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    
    const result = await reportingService.getTrialBalance({ startDate, endDate });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error generating trial balance:', error);
    
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as any;
      return NextResponse.json(
        {
          message: serviceError.message,
          code: serviceError.code,
          details: serviceError.details
        },
        { status: serviceError.statusCode }
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