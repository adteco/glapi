// Mock authentication and service context
// In a real implementation, this would integrate with your auth system (Clerk, Auth0, etc.)

export interface ServiceContext {
  userId: string;
  organizationId: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export function getServiceContext(): ServiceContext {
  // In a real implementation, this would:
  // 1. Get the current user from the session/token
  // 2. Extract the organization ID from the user or headers
  // 3. Return the proper context
  
  // For now, return mock data
  return {
    userId: 'user-123',
    organizationId: 'org-456',
    user: {
      id: 'user-123',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
    },
  };
}

export function requireAuth() {
  const context = getServiceContext();
  
  if (!context.userId || !context.organizationId) {
    throw new Error('Authentication required');
  }
  
  return context;
}