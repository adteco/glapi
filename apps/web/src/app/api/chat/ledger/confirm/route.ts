import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createTRPCMCPClient } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = await currentUser();
    const body = await request.json();
    const { conversationId, pendingActionId, pendingAction } = body;

    if (!conversationId || !pendingActionId) {
      return NextResponse.json(
        { message: 'conversationId and pendingActionId are required' },
        { status: 400 }
      );
    }

    // Get organization ID from Clerk org or user metadata
    const organizationId = orgId || (user?.publicMetadata?.organizationId as string) || 'default-org';

    // If pendingAction data is provided (from client), execute directly
    // This handles serverless environments where state isn't preserved
    if (!pendingAction?.toolName || !pendingAction?.parameters) {
      return NextResponse.json({
        success: false,
        message: 'Conversation not found. Please try the action again.',
      });
    }

    // Create MCP client with proper org context
    // Server-side needs absolute URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/trpc`
      : 'http://localhost:3030/api/trpc';

    const mcpClient = createTRPCMCPClient({
      organizationId,
      userId,
      baseUrl,
      enableLogging: process.env.NODE_ENV === 'development',
    });

    // Execute the action
    let result;
    try {
      const data = await mcpClient.callTool(
        pendingAction.toolName,
        pendingAction.parameters,
        'clerk-auth-token'
      );
      result = {
        success: true,
        data,
        intent: pendingAction.intent,
      };
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : 'Action execution failed',
        intent: pendingAction.intent,
      };
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Action completed successfully.`,
        intentId: result.intent?.id,
        data: result.data,
      });
    } else {
      return NextResponse.json({
        success: false,
        message: result.error || 'Failed to complete the action.',
        intentId: result.intent?.id,
      });
    }
  } catch (error) {
    console.error('Confirm action error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'An error occurred while confirming the action.',
      },
      { status: 500 }
    );
  }
}
