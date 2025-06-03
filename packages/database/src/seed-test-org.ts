import { db } from './db/index';
import { organizations } from './db/schema/organizations';

async function seedTestOrganization() {
  try {
    console.log('Seeding test organization...');
    
    // Check if the test organization already exists
    const existing = await db
      .select()
      .from(organizations)
      .where((t) => t.id.eq('organization-default-dev'))
      .limit(1);
    
    if (existing.length > 0) {
      console.log('Test organization already exists');
      return;
    }
    
    // Create test organization with a fixed ID for development
    const result = await db
      .insert(organizations)
      .values({
        id: 'organization-default-dev',
        stytchOrgId: 'org_test_development', // This will be used for Clerk org IDs in dev
        name: 'Development Organization',
        slug: 'dev-org',
        settings: {
          isTestOrg: true,
          features: ['gl_accounts', 'customers', 'organizations']
        }
      })
      .returning();
    
    console.log('Test organization created:', result[0]);
  } catch (error) {
    console.error('Error seeding test organization:', error);
  } finally {
    await db.$client.end();
  }
}

// Run the seed
seedTestOrganization();