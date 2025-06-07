import { NextRequest, NextResponse } from 'next/server';
import { OrganizationService } from '@glapi/api-service';
import { isServiceError } from '../../utils/errors';

// GET /api/organizations/default
// Get the default organization for development
export async function GET(_request: NextRequest) {
  try {
    // Initialize the organization service
    const orgService = new OrganizationService();
    
    // Create or get default organization
    const defaultOrg = await orgService.findOrCreateOrganization({
      organization_id: '00000000-0000-0000-0000-000000000001',
      organization_name: 'Default Organization',
      organization_slug: 'default-org'
    });
    
    return NextResponse.json({ organization: defaultOrg });
  } catch (error) {
    console.error('Error getting default organization:', error);
    
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