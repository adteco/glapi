import { NextRequest, NextResponse } from 'next/server';
import { OrganizationService } from '@glapi/api-service';
import { getServiceContext } from '../utils/auth';

// GET /api/organizations - Get all organizations (requires admin role)
export async function GET(request: NextRequest) {
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
    if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
      const serviceError = error as any;
      return NextResponse.json(
        {
          message: serviceError.message,
          code: serviceError.code,
          details: serviceError.details
        },
        { status: serviceError.statusCode }
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