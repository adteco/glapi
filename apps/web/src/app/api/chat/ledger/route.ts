import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createConversationalService, createDefaultUserContext, type UserRole } from '@/lib/ai';

// Mock MCP client for now - in production, this would connect to actual MCP servers
const mockMcpClient = {
  async callTool(toolName: string, parameters: Record<string, unknown>, _authToken: string) {
    // Simulate API calls with mock data
    const mockResponses: Record<string, unknown> = {
      list_customers: { customers: [{ id: '1', name: 'Acme Corp' }, { id: '2', name: 'Globex Inc' }] },
      list_vendors: { vendors: [{ id: '1', name: 'Supplier A' }] },
      list_invoices: { invoices: [{ id: '1', amount: 5000, status: 'pending' }] },
      generate_balance_sheet: { report: 'Balance Sheet data...', totalAssets: 100000, totalLiabilities: 40000 },
      generate_income_statement: { report: 'Income Statement...', revenue: 250000, expenses: 180000 },
      help: { capabilities: ['List and manage customers', 'Create invoices', 'Generate reports', 'Journal entries'] },
    };

    return mockResponses[toolName] || { success: true, message: `Executed ${toolName}` };
  },
};

// Create conversational service instance
let conversationalService: ReturnType<typeof createConversationalService> | null = null;

function getConversationalService() {
  if (!conversationalService) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    conversationalService = createConversationalService({
      openaiApiKey: apiKey,
      mcpClient: mockMcpClient,
      systemPrompt: `You are a helpful accounting assistant for GLAPI, a general ledger and revenue recognition system.
You can help users with:
- Managing customers, vendors, and employees
- Creating and viewing invoices
- Journal entries and general ledger operations
- Generating financial reports (balance sheet, income statement, cash flow)
- Revenue recognition tasks

Always be professional and provide clear, concise responses. When performing actions that modify data, confirm with the user first.
If you're unsure about something, ask for clarification.`,
      enableLogging: process.env.NODE_ENV === 'development',
    });
  }
  return conversationalService;
}

// Map Clerk user metadata to GLAPI role
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
    const { message, conversationId, conversationHistory } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ message: 'Message is required' }, { status: 400 });
    }

    // Create user context from Clerk user
    const orgId = (user?.publicMetadata?.organizationId as string) || 'default-org';
    const userRole = mapClerkRoleToGlapiRole(user?.publicMetadata?.role as string);
    const userContext = createDefaultUserContext(userId, orgId, userRole);

    // Get or create conversational service
    const service = getConversationalService();

    // Process the message
    const response = await service.processMessage(
      message,
      conversationHistory || [],
      userContext,
      'mock-auth-token', // In production, use actual auth token
      conversationId || `conv_${Date.now()}`
    );

    // Get the most recent pending action ID if any exist
    const pendingActionId = response.pendingConfirmations.length > 0
      ? response.pendingConfirmations[response.pendingConfirmations.length - 1].id
      : undefined;

    return NextResponse.json({
      message: response.message,
      conversationId: response.conversationId,
      metadata: {
        intentId: response.actionResult?.intent?.id,
        riskLevel: response.actionResult?.intent?.riskLevel,
        requiresConfirmation: response.actionResult?.requiresConfirmation || false,
        confirmationMessage: response.actionResult?.confirmationMessage,
        pendingActionId,
        success: response.actionResult?.success,
        error: response.actionResult?.error,
        actionAttempted: response.actionAttempted,
        pendingConfirmations: response.pendingConfirmations,
      },
    });
  } catch (error) {
    console.error('Conversational ledger error:', error);

    // Return user-friendly error message
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    return NextResponse.json(
      {
        message: errorMessage.includes('OPENAI_API_KEY')
          ? 'The AI service is not configured. Please contact an administrator.'
          : 'Sorry, I encountered an error processing your request. Please try again.',
        metadata: {
          error: errorMessage,
        },
      },
      { status: 500 }
    );
  }
}
