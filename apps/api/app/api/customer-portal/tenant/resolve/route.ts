import { NextRequest, NextResponse } from 'next/server';
import { OrganizationRepository } from '@glapi/database';
import { resolvePortalOrgSlug } from '../../auth/_lib';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const orgSlug = resolvePortalOrgSlug(request);
    if (!orgSlug) {
      return NextResponse.json({ message: 'Unable to resolve tenant' }, { status: 400 });
    }

    const organizationRepo = new OrganizationRepository();
    const organization = await organizationRepo.findBySlug(orgSlug);
    if (!organization) {
      return NextResponse.json({ message: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json({
      organization: {
        id: organization.id,
        slug: organization.slug,
        name: organization.name,
      },
    });
  } catch (error) {
    console.error('Failed to resolve portal tenant:', error);
    return NextResponse.json({ message: 'Failed to resolve tenant' }, { status: 500 });
  }
}
