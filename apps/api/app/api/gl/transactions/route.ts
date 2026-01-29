import { NextRequest, NextResponse } from 'next/server';
import { GlTransactionService, createBusinessTransactionSchema } from '@glapi/api-service';
import { getServiceContext } from '../../utils/auth';
import { isServiceError } from '../../utils/errors';

// POST /api/gl/transactions - Create a new GL transaction
export async function POST(request: NextRequest) {
  try {
    const context = await getServiceContext();
    const body = await request.json() as any;
    
    console.log('Creating GL transaction with context:', context);
    console.log('Request body:', body);
    
    // Validate request body - expecting transaction and lines
    if (!body?.transaction || !body?.lines || !Array.isArray(body.lines)) {
      return NextResponse.json(
        {
          message: 'Invalid request body. Expected { transaction: {...}, lines: [...] }'
        },
        { status: 400 }
      );
    }
    
    const parsedData = createBusinessTransactionSchema.safeParse(body.transaction);
    
    if (!parsedData.success) {
      return NextResponse.json(
        {
          message: 'Invalid transaction data',
          errors: parsedData.error.errors
        },
        { status: 400 }
      );
    }
    
    const transactionService = new GlTransactionService(context);
    const result = await transactionService.createBusinessTransaction({
      transaction: parsedData.data,
      lines: body.lines
    });
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating GL transaction:', error);
    
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

// GET /api/gl/transactions - List all GL transactions
export async function GET(request: NextRequest) {
  try {
    const context = await getServiceContext();
    const transactionService = new GlTransactionService(context);
    
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;
    const transactionTypeId = searchParams.get('transactionTypeId') || undefined;
    const status = searchParams.get('status') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const subsidiaryId = searchParams.get('subsidiaryId') || undefined;
    const entityId = searchParams.get('entityId') || undefined;
    
    const result = await transactionService.listBusinessTransactions(
      { page, limit },
      {
        transactionTypeId,
        status,
        dateFrom,
        dateTo,
        subsidiaryId,
        entityId
      }
    );
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing GL transactions:', error);
    
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