import { NextRequest, NextResponse } from 'next/server';
import { trpcClient } from '@/lib/trpc-server';
import { auth } from '@clerk/nextjs/server';

// Calculate revenue for subscription
export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, ...data } = body;

    switch (action) {
      case 'calculate': {
        const result = await trpcClient.revenue.calculate.mutate(data);
        return NextResponse.json(result);
      }
      
      case 'recognize': {
        const result = await trpcClient.revenue.recognize.mutate(data);
        return NextResponse.json(result);
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Revenue API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.code === 'NOT_FOUND' ? 404 : 500 }
    );
  }
}

// Get revenue data
export async function GET(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    switch (type) {
      case 'schedules': {
        const result = await trpcClient.revenue.schedules.list.query({
          subscriptionId: searchParams.get('subscriptionId') || undefined,
          status: searchParams.get('status') as any,
          page: parseInt(searchParams.get('page') || '1'),
          limit: parseInt(searchParams.get('limit') || '50')
        });
        return NextResponse.json(result);
      }
      
      case 'obligations': {
        const result = await trpcClient.revenue.performanceObligations.list.query({
          subscriptionId: searchParams.get('subscriptionId') || undefined,
          status: searchParams.get('status') as any,
          page: parseInt(searchParams.get('page') || '1'),
          limit: parseInt(searchParams.get('limit') || '50')
        });
        return NextResponse.json(result);
      }
      
      case 'summary': {
        const result = await trpcClient.revenue.reports.summary.query({
          startDate: new Date(searchParams.get('startDate') || new Date()),
          endDate: new Date(searchParams.get('endDate') || new Date()),
          groupBy: searchParams.get('groupBy') as any || 'month'
        });
        return NextResponse.json(result);
      }
      
      case 'arr': {
        const result = await trpcClient.revenue.reports.arr.query({
          asOfDate: searchParams.get('asOfDate') ? new Date(searchParams.get('asOfDate')!) : undefined
        });
        return NextResponse.json(result);
      }
      
      case 'mrr': {
        const result = await trpcClient.revenue.reports.mrr.query({
          forMonth: searchParams.get('forMonth') ? new Date(searchParams.get('forMonth')!) : undefined
        });
        return NextResponse.json(result);
      }
      
      case 'deferred': {
        const result = await trpcClient.revenue.reports.deferredBalance.query({
          asOfDate: searchParams.get('asOfDate') ? new Date(searchParams.get('asOfDate')!) : undefined
        });
        return NextResponse.json(result);
      }
      
      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Revenue API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.code === 'NOT_FOUND' ? 404 : 500 }
    );
  }
}