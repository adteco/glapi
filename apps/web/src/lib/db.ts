import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { schema } from '@glapi/database/src/db/schema';

// Use environment variable for database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/revenue_recognition';

// Create a Postgres client
const client = postgres(connectionString);

// Create a Drizzle ORM instance
export const db = drizzle(client, { schema });

// Helper to connect to organization's database context
export async function withOrganization(stytchOrgId: string) {
  try {
    // In a real implementation, we would:
    // 1. Query our database to find the internal organization ID that maps to this Stytch org ID
    // 2. Set up any necessary context or session variables to scope queries to this organization
    
    // Example query to get organization ID (mock for now)
    // const [org] = await db.organizations
    //   .select({ id: organizations.id })
    //   .where(eq(organizations.stytchOrgId, stytchOrgId))
    //   .limit(1);
    
    // return org ? org.id : null;
    
    // For now, return a mock ID
    return "org-123";
  } catch (error) {
    console.error('Error connecting to organization context:', error);
    throw error;
  }
}