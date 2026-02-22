const { Client } = require('pg');

async function checkCustomers() {
  // Get database URL from environment
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    await client.connect();
    
    console.log('Recent customers in database:');
    console.log('===========================');
    
    const result = await client.query(`
      SELECT 
        id, 
        organization_id, 
        company_name,
        created_at 
      FROM customers 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    if (result.rows.length === 0) {
      console.log('No customers found');
    } else {
      result.rows.forEach(row => {
        console.log(`
ID: ${row.id}
Organization: ${row.organization_id}
Company: ${row.company_name}
Created: ${row.created_at}
---`);
      });
    }
    
    // Also check unique organization IDs
    console.log('\nUnique organization IDs in customers table:');
    console.log('==========================================');
    
    const orgResult = await client.query(`
      SELECT DISTINCT organization_id, COUNT(*) as customer_count
      FROM customers
      GROUP BY organization_id
    `);
    
    orgResult.rows.forEach(row => {
      console.log(`${row.organization_id}: ${row.customer_count} customers`);
    });
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkCustomers();
