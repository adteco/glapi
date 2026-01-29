import { NextRequest, NextResponse } from 'next/server';
import { AccountService, UpdateAccountSchema } from '@glapi/api-service';
import { getServiceContext } from '../../../utils/auth';
import { isServiceError } from '../../../utils/errors';

// GET /api/gl/accounts/[id] - Get a single GL account
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getServiceContext();
    const accountService = new AccountService(context);
    
    const account = await accountService.getAccountById(params.id);
    
    return NextResponse.json(account);
  } catch (error) {
    console.error('Error fetching GL account:', error);
    
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

// PUT /api/gl/accounts/[id] - Update a GL account
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getServiceContext();
    const body = await request.json() as any;
    
    // Validate request body against schema
    const parsedData = UpdateAccountSchema.safeParse(body);
    
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
    const updatedAccount = await accountService.updateAccount(params.id, parsedData.data);
    
    return NextResponse.json(updatedAccount);
  } catch (error) {
    console.error('Error updating GL account:', error);
    
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

// DELETE /api/gl/accounts/[id] - Delete a GL account
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getServiceContext();
    const accountService = new AccountService(context);
    
    await accountService.deleteAccount(params.id);
    
    return NextResponse.json({ message: 'Account deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting GL account:', error);
    
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