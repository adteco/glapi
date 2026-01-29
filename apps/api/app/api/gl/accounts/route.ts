import { NextRequest, NextResponse } from 'next/server';
import { AccountService, NewAccountSchema } from '@glapi/api-service';
import { getServiceContext } from '../../utils/auth';
import { isServiceError } from '../../utils/errors';

// GET /api/gl/accounts - Get all GL accounts
export async function GET(request: NextRequest) {
  try {
    const context = await getServiceContext();
    const accountService = new AccountService(context);
    
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const orderBy = (searchParams.get('orderBy') as 'accountNumber' | 'accountName' | 'createdAt') || 'accountNumber';
    const orderDirection = (searchParams.get('orderDirection') as 'asc' | 'desc') || 'asc';
    const accountCategory = searchParams.get('accountCategory') as any || undefined;
    const isActive = searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined;
    
    const result = await accountService.listAccounts(
      { page, limit },
      orderBy,
      orderDirection,
      {
        accountCategory,
        isActive
      }
    );
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching GL accounts:', error);
    
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

// POST /api/gl/accounts - Create a new GL account
export async function POST(request: NextRequest) {
  try {
    const context = await getServiceContext();
    const body = await request.json() as any;
    
    // Validate request body against schema
    const parsedData = NewAccountSchema.safeParse(body);
    
    if (!parsedData.success) {
      return NextResponse.json(
        {
          message: 'Invalid account data',
          errors: parsedData.error.errors
        },
        { status: 400 }
      );
    }
    
    const accountService = new AccountService(context);
    const newAccount = await accountService.createAccount({
      ...parsedData.data,
      organizationId: context.organizationId
    });
    
    return NextResponse.json(newAccount, { status: 201 });
  } catch (error) {
    console.error('Error creating GL account:', error);
    
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