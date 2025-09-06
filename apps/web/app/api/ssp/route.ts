import { NextRequest, NextResponse } from 'next/server';
import { trpcClient } from '@/lib/trpc-server';
import { auth } from '@clerk/nextjs/server';

// Create SSP evidence
export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const result = await trpcClient.revenue.ssp.create.mutate(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('SSP API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.code === 'NOT_FOUND' ? 404 : 500 }
    );
  }
}

// Get SSP evidence and data
export async function GET(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const itemId = searchParams.get('itemId');

    switch (type) {
      case 'current': {
        if (!itemId) {
          return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
        }
        const result = await trpcClient.revenue.ssp.current.query({ itemId });
        return NextResponse.json(result);
      }
      
      case 'range': {
        if (!itemId) {
          return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
        }
        const result = await trpcClient.revenue.ssp.range.query({ itemId });
        return NextResponse.json(result);
      }
      
      case 'summary': {
        const itemIds = searchParams.get('itemIds')?.split(',').filter(Boolean);
        const result = await trpcClient.revenue.ssp.summary.query({ itemIds });
        return NextResponse.json(result);
      }
      
      default: {
        // List SSP evidence
        const result = await trpcClient.revenue.ssp.list.query({
          itemId: itemId || undefined,
          evidenceType: searchParams.get('evidenceType') as any,
          isActive: searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined,
          page: parseInt(searchParams.get('page') || '1'),
          limit: parseInt(searchParams.get('limit') || '50')
        });
        return NextResponse.json(result);
      }
    }
  } catch (error: any) {
    console.error('SSP API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.code === 'NOT_FOUND' ? 404 : 500 }
    );
  }
}

// Update SSP evidence
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
    const result = await trpcClient.revenue.ssp.update.mutate({
      id,
      data: body
    });
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('SSP API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.code === 'NOT_FOUND' ? 404 : 500 }
    );
  }
}

// Deactivate SSP evidence
export async function DELETE(req: NextRequest) {
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

    const result = await trpcClient.revenue.ssp.deactivate.mutate({ id });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('SSP API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.code === 'NOT_FOUND' ? 404 : 500 }
    );
  }
}