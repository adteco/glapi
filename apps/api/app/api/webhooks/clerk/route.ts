import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { AuthEntityRepository, OrganizationRepository } from '@glapi/database';

const authEntityRepository = new AuthEntityRepository();
const organizationRepository = new OrganizationRepository();

export async function POST(req: Request) {
  // Get the webhook secret from environment variables
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('Missing CLERK_WEBHOOK_SECRET environment variable');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: 'Missing svix headers' },
      { status: 400 }
    );
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 400 }
    );
  }

  // Handle the webhook event
  const eventType = evt.type;
  console.log(`Received Clerk webhook: ${eventType}`);

  try {
    switch (eventType) {
      case 'user.created': {
        const { id, email_addresses, first_name, last_name, organization_memberships } = evt.data;
        const primaryEmail = email_addresses.find((e) => e.id === evt.data.primary_email_address_id)?.email_address;

        if (!primaryEmail) {
          console.error('No primary email found for user:', id);
          return NextResponse.json({ error: 'No primary email' }, { status: 400 });
        }

        // Get the organization ID - use the first organization membership if available
        let organizationId: string | null = null;

        if (organization_memberships && organization_memberships.length > 0) {
          const clerkOrgId = organization_memberships[0].organization.id;
          // Look up the database organization by Clerk org ID
          const org = await organizationRepository.findByClerkId(clerkOrgId);
          if (org) {
            organizationId = org.id;
          }
        }

        // If no organization found, try to find a default one or skip
        if (!organizationId) {
          console.log(`User ${id} has no organization, skipping database entity creation`);
          // We'll create the entity when they join an organization
          return NextResponse.json({ received: true, skipped: 'no_organization' });
        }

        // Check if entity already exists with this Clerk ID
        const existingEntity = await authEntityRepository.findByClerkId(id);
        if (existingEntity) {
          console.log(`Entity ${existingEntity.id} already exists for Clerk user ${id}`);
          return NextResponse.json({ received: true, existing: true, entityId: existingEntity.id });
        }

        // Create an Employee entity with auth capabilities
        const fullName = [first_name, last_name].filter(Boolean).join(' ') || primaryEmail;
        const entity = await authEntityRepository.createUserEntity({
          clerkUserId: id,
          email: primaryEmail,
          name: fullName,
          displayName: fullName !== primaryEmail ? fullName : null,
          organizationId,
          role: 'user',
        });

        console.log(`Created entity ${entity.id} (Employee) for Clerk user ${id}`);
        return NextResponse.json({ received: true, entityId: entity.id });
      }

      case 'user.updated': {
        const { id, email_addresses, first_name, last_name } = evt.data;
        const primaryEmail = email_addresses.find((e) => e.id === evt.data.primary_email_address_id)?.email_address;

        if (primaryEmail) {
          const fullName = [first_name, last_name].filter(Boolean).join(' ') || primaryEmail;
          await authEntityRepository.updateByClerkId(id, {
            email: primaryEmail,
            name: fullName,
            displayName: fullName !== primaryEmail ? fullName : null,
          });
          console.log(`Updated entity for Clerk user ${id}`);
        }

        return NextResponse.json({ received: true });
      }

      case 'user.deleted': {
        const { id } = evt.data;
        if (id) {
          // Soft delete (deactivate) the entity rather than hard delete
          const deactivated = await authEntityRepository.deactivateByClerkId(id);
          console.log(`Deactivated entity for Clerk user ${id}: ${deactivated ? 'success' : 'not found'}`);
        }
        return NextResponse.json({ received: true });
      }

      case 'organizationMembership.created': {
        // When a user joins an organization, create their entity record
        const { organization, public_user_data } = evt.data;
        const clerkUserId = public_user_data.user_id;

        // Check if entity already exists with this Clerk ID
        const existingEntity = await authEntityRepository.findByClerkId(clerkUserId);
        if (existingEntity) {
          console.log(`Entity ${existingEntity.id} already exists for Clerk user ${clerkUserId}`);
          return NextResponse.json({ received: true, existing: true, entityId: existingEntity.id });
        }

        // Look up the database organization
        const org = await organizationRepository.findByClerkId(organization.id);
        if (!org) {
          console.log(`Organization ${organization.id} not found in database`);
          return NextResponse.json({ received: true, skipped: 'org_not_found' });
        }

        // Create an Employee entity with auth capabilities
        const email = public_user_data.identifier || `${clerkUserId}@placeholder.local`;
        const fullName = [public_user_data.first_name, public_user_data.last_name].filter(Boolean).join(' ') || email;
        const entity = await authEntityRepository.createUserEntity({
          clerkUserId,
          email,
          name: fullName,
          displayName: fullName !== email ? fullName : null,
          organizationId: org.id,
          role: 'user',
        });

        console.log(`Created entity ${entity.id} (Employee) for Clerk user ${clerkUserId} in org ${org.id}`);
        return NextResponse.json({ received: true, entityId: entity.id });
      }

      default:
        console.log(`Unhandled webhook event type: ${eventType}`);
        return NextResponse.json({ received: true });
    }
  } catch (error) {
    console.error(`Error handling webhook ${eventType}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
