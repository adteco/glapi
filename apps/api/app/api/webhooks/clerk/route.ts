import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { UserRepository, OrganizationRepository } from '@glapi/database';

const userRepository = new UserRepository();
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
          console.log(`User ${id} has no organization, skipping database user creation`);
          // We'll create the user when they join an organization
          return NextResponse.json({ received: true, skipped: 'no_organization' });
        }

        // Check if user already exists
        const existingUser = await userRepository.findByClerkId(id);
        if (existingUser) {
          console.log(`User ${id} already exists in database`);
          return NextResponse.json({ received: true, existing: true });
        }

        // Create the user
        const user = await userRepository.create({
          clerkUserId: id,
          email: primaryEmail,
          firstName: first_name || null,
          lastName: last_name || null,
          organizationId,
          role: 'user',
        });

        console.log(`Created database user ${user.id} for Clerk user ${id}`);
        return NextResponse.json({ received: true, userId: user.id });
      }

      case 'user.updated': {
        const { id, email_addresses, first_name, last_name } = evt.data;
        const primaryEmail = email_addresses.find((e) => e.id === evt.data.primary_email_address_id)?.email_address;

        if (primaryEmail) {
          await userRepository.updateByClerkId(id, {
            email: primaryEmail,
            firstName: first_name || null,
            lastName: last_name || null,
          });
          console.log(`Updated database user for Clerk user ${id}`);
        }

        return NextResponse.json({ received: true });
      }

      case 'user.deleted': {
        const { id } = evt.data;
        if (id) {
          const deleted = await userRepository.deleteByClerkId(id);
          console.log(`Deleted database user for Clerk user ${id}: ${deleted}`);
        }
        return NextResponse.json({ received: true });
      }

      case 'organizationMembership.created': {
        // When a user joins an organization, create their database user record
        const { organization, public_user_data } = evt.data;
        const clerkUserId = public_user_data.user_id;

        // Check if user already exists
        const existingUser = await userRepository.findByClerkId(clerkUserId);
        if (existingUser) {
          console.log(`User ${clerkUserId} already exists in database`);
          return NextResponse.json({ received: true, existing: true });
        }

        // Look up the database organization
        const org = await organizationRepository.findByClerkId(organization.id);
        if (!org) {
          console.log(`Organization ${organization.id} not found in database`);
          return NextResponse.json({ received: true, skipped: 'org_not_found' });
        }

        // Create the user
        const user = await userRepository.create({
          clerkUserId,
          email: public_user_data.identifier || `${clerkUserId}@placeholder.local`,
          firstName: public_user_data.first_name || null,
          lastName: public_user_data.last_name || null,
          organizationId: org.id,
          role: 'user',
        });

        console.log(`Created database user ${user.id} for Clerk user ${clerkUserId} in org ${org.id}`);
        return NextResponse.json({ received: true, userId: user.id });
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
