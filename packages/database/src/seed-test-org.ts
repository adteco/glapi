import { db } from './db';
import { organizations } from './db/schema/organizations';
import { eq } from 'drizzle-orm';

async function seedTestOrg() {
  try {
    console.log('Seeding test organization...');
    
    // Check if the test organization already exists
    const existingOrg = await db.select().from(organizations).where(eq(organizations.name, 'Stytch Test Community'));
    
    if (existingOrg.length > 0) {
      console.log('Test organization already exists');
      return;
    }
    
    // Create test organization with a fixed ID for development
    await db.insert(organizations).values({
      name: 'Stytch Test Community',
      stytchOrgId: 'organization-id-123',
      slug: 'stytch-test-community'
    });
    
    console.log('Test organization seeded successfully.');
  } catch (error) {
    console.error('Error seeding test organization:', error);
  } finally {
    await db.$client.end();
  }
}

// Run the seed
seedTestOrg();