import { NextRequest, NextResponse } from 'next/server';
import { OrganizationService } from '@glapi/api-service';
import { isServiceError } from '../../utils/errors';

// GET /api/organizations/lookup
// Lookup an organization by its Stytch organization ID
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const stytchOrgId = searchParams.get('stytchOrgId');
    
    if (!stytchOrgId) {
      return NextResponse.json(
        { message: 'Missing required parameter: stytchOrgId' },
        { status: 400 }
      );
    }
    
    // Initialize the organization service
    const orgService = new OrganizationService();
    
    // Look up the organization
    const organization = await orgService.getOrganizationByStytchId(stytchOrgId);
    
    if (!organization) {
      // If not found, create a new one
      console.log('Organization not found, creating a new one');
      try {
        const newOrg = await orgService.findOrCreateOrganization({
          organization_id: stytchOrgId,
          organization_name: 'New Organization',
          organization_slug: `org-${Date.now()}`
        });
        
        return NextResponse.json({ 
          organization: newOrg,
          isNew: true
        });
      } catch (createError) {
        console.error('Error creating organization:', createError);
        throw createError;
      }
    }
    
    return NextResponse.json({ organization });
  } catch (error) {
    console.error('Error looking up organization:', error);
    
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