import { NextRequest, NextResponse } from 'next/server';
import { trpcClient } from '@/lib/trpc-server';
import { auth } from '@clerk/nextjs/server';

// Get revenue schedules
export async function GET(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      // Get single schedule
      const result = await trpcClient.revenue.schedules.get.query({ id });
      return NextResponse.json(result);
    }

    // List schedules
    const result = await trpcClient.revenue.schedules.list.query({
      subscriptionId: searchParams.get('subscriptionId') || undefined,
      performanceObligationId: searchParams.get('performanceObligationId') || undefined,
      status: searchParams.get('status') as any,
      periodStart: searchParams.get('periodStart') ? new Date(searchParams.get('periodStart')!) : undefined,
      periodEnd: searchParams.get('periodEnd') ? new Date(searchParams.get('periodEnd')!) : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50')
    });
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Revenue schedules API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.code === 'NOT_FOUND' ? 404 : 500 }
    );
  }
}

// Update revenue schedule
export async function PUT(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const result = await trpcClient.revenue.schedules.update.mutate({
      id,
      data: {
        scheduledAmount: body.scheduledAmount,
        recognitionDate: body.recognitionDate ? new Date(body.recognitionDate) : undefined,
        status: body.status
      }
    });
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Revenue schedules API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.code === 'NOT_FOUND' ? 404 : 500 }
    );
  }
}