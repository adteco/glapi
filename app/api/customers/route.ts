import { NextResponse, type NextRequest } from 'next/server';
import { CustomerService, NewCustomerSchema } from '@glapi/api-service';
import { getServiceContext } from '@/lib/server/getServiceContext'; // We will create this helper

export async function POST(request: NextRequest) {
  try {
    const context = await getServiceContext(request);
    const body = await request.json();

    const parsedData = NewCustomerSchema.safeParse({
      ...body,
      organizationId: context.organizationId,
    });

    if (!parsedData.success) {
      return NextResponse.json(
        {
          message: 'Invalid customer data',
          errors: parsedData.error.errors,
        },
        { status: 400 }
      );
    }

    const customerService = new CustomerService(context);
    const result = await customerService.createCustomer(parsedData.data);

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Error creating customer:', error);
    if (error.statusCode) {
      return NextResponse.json(
        { message: error.message, code: error.code, details: error.details },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ message: 'Something went wrong!' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const context = await getServiceContext(request);
    const customerService = new CustomerService(context);
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const orderBy = (searchParams.get('orderBy') as 'companyName' | 'createdAt') || 'companyName';
    const orderDirection = (searchParams.get('orderDirection') as 'asc' | 'desc') || 'asc';
    const status = searchParams.get('status') || undefined;

    const result = await customerService.listCustomers(
      { page, limit },
      orderBy,
      orderDirection,
      { status }
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error listing customers:', error);
    if (error.statusCode) {
      return NextResponse.json(
        { message: error.message, code: error.code, details: error.details },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ message: 'Something went wrong!' }, { status: 500 });
  }
} 