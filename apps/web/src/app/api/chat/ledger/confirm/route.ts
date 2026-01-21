import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createActionExecutor, createDefaultUserContext, type UserRole } from '@/lib/ai';

// Mock MCP client - shared with main route in production
const mockMcpClient = {
  async callTool(toolName: string, parameters: Record<string, unknown>, _authToken: string) {
    const mockResponses: Record<string, unknown> = {
      create_customer: { id: 'cust_' + Date.now(), name: parameters.name || 'New Customer' },
      create_invoice: { id: 'inv_' + Date.now(), amount: parameters.amount || 0 },
      create_journal_entry: { id: 'je_' + Date.now(), status: 'posted' },
    };
    return mockResponses[toolName] || { success: true };
  },
};

// In production, this would be a shared instance via Redis or similar
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

function mapClerkRoleToGlapiRole(clerkRole?: string): UserRole {
  const roleMap: Record<string, UserRole> = {
    admin: 'admin',
    accountant: 'accountant',
    manager: 'manager',
    staff: 'staff',
    viewer: 'viewer',
  };
  return roleMap[clerkRole || ''] || 'staff';
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = await currentUser();
    const body = await request.json();
    const { conversationId, pendingActionId } = body;

    if (!conversationId || !pendingActionId) {
      return NextResponse.json(
        { message: 'conversationId and pendingActionId are required' },
        { status: 400 }
      );
    }

    const executor = getActionExecutor();

    // Confirm the pending action
    const result = await executor.confirmAction(
      conversationId,
      pendingActionId,
      'mock-auth-token'
    );

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
