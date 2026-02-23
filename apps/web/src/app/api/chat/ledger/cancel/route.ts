import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createActionExecutor } from '@/lib/ai/action-executor';

// Mock MCP client - shared with main route in production
const mockMcpClient = {
  async callTool() {
    return { success: true };
  },
};

// In production, this would be a shared instance
let actionExecutor: ReturnType<typeof createActionExecutor> | null = null;

function getActionExecutor() {
  if (!actionExecutor) {
    actionExecutor = createActionExecutor({
      mcpClient: mockMcpClient,
      enableLogging: process.env.NODE_ENV === 'development',
    });
  }
  return actionExecutor;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { conversationId, pendingActionId } = body;

    if (!conversationId || !pendingActionId) {
      return NextResponse.json(
        { message: 'conversationId and pendingActionId are required' },
        { status: 400 }
      );
    }

    const executor = getActionExecutor();

    // Cancel the pending action
    const cancelled = executor.cancelAction(conversationId, pendingActionId);

    return NextResponse.json({
      success: true,
      cancelled,
      message: cancelled ? 'Action cancelled.' : 'Action was already cancelled or expired.',
    });
  } catch (error) {
    console.error('Cancel action error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'An error occurred while cancelling the action.',
      },
      { status: 500 }
    );
  }
}
