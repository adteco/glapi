import { NextRequest, NextResponse } from 'next/server';
import { OrganizationService } from '@glapi/api-service';
import { getServiceContext } from '../utils/auth';
import { isServiceError } from '../utils/errors';

// GET /api/organizations - Get all organizations (requires admin role)
export async function GET(_request: NextRequest) {
  try {
    // Use just the service directly without requiring context
    // In a real app, we'd check for admin role here
    const orgService = new OrganizationService();
    
    // This is a sample implementation - in a real app, we'd query the database
    // For now we'll just return organization by ID
    const context = getServiceContext();
    const organization = await orgService.getOrganizationById(context.organizationId);
    
    const organizations = organization ? [organization] : [];
    
    return NextResponse.json({
      organizations,
      total: organizations.length,
      page: 1,
      limit: 10,
      totalPages: 1
    });
  } catch (error) {
    console.error('Error getting organizations:', error);
    
    // Check if it's a ServiceError
    if (isServiceError(error)) {
      return NextResponse.json(
        {
          message: error.message,
          code: error.code,
          details: error.details
        },
        { status: error.statusCode }
      );
    }
    
    // Generic error handling
    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}