/**
 * Database setup script to create a default organization
 * This will create the organization directly in the database
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/glapi_dev'
});

const getOrCreateDefaultOrganization = async () => {
  try {
    // Create a simple organization - this SQL doesn't use any schema
    // because we're directly creating a record in the organizations table
    const result = await pool.query(`
      INSERT INTO organizations (
        id, 
        stytch_org_id, 
        name, 
        slug, 
        settings
      ) 
      VALUES (
        $1, 
        $2, 
        $3, 
        $4, 
        $5
      )
      ON CONFLICT (stytch_org_id) DO UPDATE 
      SET name = EXCLUDED.name
      RETURNING id, stytch_org_id, name, slug;
    `, [
      'org-123456789', // Use our hardcoded ID
      '00000000-0000-0000-0000-000000000001', // Default Stytch org ID
      'Default Organization',
      'default-org',
      JSON.stringify({})
    ]);

    console.log('Default organization created/found:', result.rows[0]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating/finding default organization:', error);
    throw error;
  }
};

// Export the function so it can be called from the server startup
export { getOrCreateDefaultOrganization };

// If this script is run directly, execute it
if (require.main === module) {
  getOrCreateDefaultOrganization()
    .then(() => {
      console.log('Database setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database setup failed:', error);
      process.exit(1);
    });
}