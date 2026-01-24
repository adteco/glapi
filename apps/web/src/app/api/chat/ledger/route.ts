import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import {
  createGeminiConversationalService,
  createTRPCMCPClient,
  createDefaultUserContext,
  type UserRole,
  GLAPI_SYSTEM_PROMPT,
} from '@/lib/ai';

// Create conversational service instance
let conversationalService: ReturnType<typeof createGeminiConversationalService> | null = null;

function getConversationalService(organizationId: string, userId: string) {
  // Create a fresh service for each request to use the correct org context
  // In production, you might want to cache these per-org
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or GEMINI_API_KEY is not configured');
  }

  // Create the TRPC-based MCP client for real database access
  const mcpClient = createTRPCMCPClient({
    organizationId,
    userId,
    enableLogging: process.env.NODE_ENV === 'development',
  });

  conversationalService = createGeminiConversationalService({
    geminiApiKey: apiKey,
    mcpClient,
    model: 'gemini-2.0-flash', // Fast and capable model
    systemPrompt: GLAPI_SYSTEM_PROMPT,
    enableLogging: process.env.NODE_ENV === 'development',
  });

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
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = await currentUser();
    const body = await request.json();
    const { message, conversationId, conversationHistory } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ message: 'Message is required' }, { status: 400 });
    }

    // Get organization ID from Clerk org or user metadata
    const organizationId = orgId || (user?.publicMetadata?.organizationId as string) || 'default-org';
    const userRole = mapClerkRoleToGlapiRole(user?.publicMetadata?.role as string);
    const userContext = createDefaultUserContext(userId, organizationId, userRole);

    // Get or create conversational service with proper org context
    const service = getConversationalService(organizationId, userId);

    // Process the message
    const response = await service.processMessage(
      message,
      conversationHistory || [],
      userContext,
      'clerk-auth-token', // The TRPC client handles auth via context
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
        message: errorMessage.includes('API_KEY')
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
