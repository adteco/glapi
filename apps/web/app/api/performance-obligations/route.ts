import { NextRequest, NextResponse } from 'next/server';
import { trpcClient } from '@/lib/trpc-server';
import { auth } from '@clerk/nextjs/server';

// Get performance obligations
export async function GET(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      // Get single obligation
      const result = await trpcClient.revenue.performanceObligations.get.query({ id });
      return NextResponse.json(result);
    }

    // List obligations
    const result = await trpcClient.revenue.performanceObligations.list.query({
      subscriptionId: searchParams.get('subscriptionId') || undefined,
      status: searchParams.get('status') as any,
      obligationType: searchParams.get('obligationType') as any,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50')
    });
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Performance obligations API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.code === 'NOT_FOUND' ? 404 : 500 }
    );
  }
}

// Satisfy performance obligation
export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, satisfactionDate, satisfactionEvidence } = body;

    if (!id || !satisfactionDate) {
      return NextResponse.json(
        { error: 'ID and satisfaction date are required' },
        { status: 400 }
      );
    }

    const result = await trpcClient.revenue.performanceObligations.satisfy.mutate({
      id,
      satisfactionDate: new Date(satisfactionDate),
      satisfactionEvidence
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Performance obligations API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.code === 'NOT_FOUND' ? 404 : 500 }
    );
  }
}