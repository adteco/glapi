import { ServiceContext } from '../types';
import { OrganizationService } from '../services/organization-service';

/**
 * Process Stytch session data and return a service context
 */
export async function createContextFromStytchSession(
  session: any
): Promise<ServiceContext> {
  if (!session) {
    return {};
  }
  
  try {
    // Extract user and organization IDs from the Stytch session
    const stytchUserId = session.member?.user_id;
    const stytchOrgId = session.organization?.organization_id;
    
    if (!stytchOrgId) {
      return { userId: stytchUserId };
    }
    
    // Find or create our organization record
    const orgService = new OrganizationService();
    const organization = await orgService.findOrCreateOrganization({
      organization_id: stytchOrgId,
      organization_name: session.organization.organization_name,
      organization_slug: session.organization.organization_slug,
    });
    
    return {
      userId: stytchUserId,
      organizationId: organization.id,
    };
  } catch (error) {
    console.error('Error creating context from Stytch session:', error);
    return {};
  }
}