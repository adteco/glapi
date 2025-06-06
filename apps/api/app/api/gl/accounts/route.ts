import { NextRequest, NextResponse } from 'next/server';
import { accountRepository } from '@glapi/database';
import { getServiceContext } from '../../utils/auth';

// GET /api/gl/accounts - Get all GL accounts
export async function GET(request: NextRequest) {
  try {
    const context = getServiceContext();
    
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const accountCategory = searchParams.get('accountCategory') || undefined;
    
    const offset = (page - 1) * limit;
    
    const accounts = await accountRepository.getAccounts(
      context.organizationId,
      limit,
      offset,
      accountCategory
    );
    
    const total = await accountRepository.getAccountsCount(
      context.organizationId,
      accountCategory
    );
    
    return NextResponse.json({
      data: accounts,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching GL accounts:', error);
    
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
    const context = getServiceContext();
    const body = await request.json();
    
    const newAccount = await accountRepository.createAccount({
      ...body,
      organization_id: context.organizationId
    });
    
    return NextResponse.json(newAccount, { status: 201 });
  } catch (error) {
    console.error('Error creating GL account:', error);
    
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