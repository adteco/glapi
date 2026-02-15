#!/usr/bin/env npx tsx
/**
 * Magneteco Setup Script
 *
 * Registers GLAPI's domain configuration with the Magneteco service.
 * Run this once after obtaining your Magneteco API credentials.
 *
 * Usage:
 *   npx tsx scripts/setup-magneteco.ts
 *
 * Required environment variables:
 *   MAGNETECO_URL - Magneteco API URL (e.g., https://api.magneteco.io/v1)
 *   MAGNETECO_API_KEY - Your Magneteco API key
 *   MAGNETECO_APP_ID - Your Magneteco app ID (from dashboard)
 *   MAGNETECO_DASHBOARD_TOKEN - Dashboard auth token (for config registration)
 */

import { createGlapiDomainConfig } from '../src/lib/ai/memory/glapi-domain-config';

async function main() {
  console.log('🧲 Magneteco Setup for GLAPI\n');

  // Check required environment variables
  const baseUrl = process.env.MAGNETECO_URL;
  const apiKey = process.env.MAGNETECO_API_KEY;
  const appId = process.env.MAGNETECO_APP_ID;
  const dashboardToken = process.env.MAGNETECO_DASHBOARD_TOKEN;

  const missing: string[] = [];
  if (!baseUrl) missing.push('MAGNETECO_URL');
  if (!apiKey) missing.push('MAGNETECO_API_KEY');
  if (!appId) missing.push('MAGNETECO_APP_ID');

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((v) => console.error(`   - ${v}`));
    console.error('\nSet these in your .env file or environment.');
    process.exit(1);
  }

  // Step 1: Test API connectivity
  console.log('1️⃣  Testing API connectivity...');
  try {
    const healthResponse = await fetch(`${baseUrl}/health`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!healthResponse.ok) {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }

    const health = await healthResponse.json();
    console.log(`   ✅ Connected to Magneteco (${health.status || 'healthy'})\n`);
  } catch (error) {
    console.error(`   ❌ Failed to connect: ${error}`);
    process.exit(1);
  }

  // Step 2: Register domain config (if dashboard token provided)
  if (dashboardToken) {
    console.log('2️⃣  Registering GLAPI domain configuration...');

    const domainConfig = createGlapiDomainConfig(appId!);

    try {
      // Note: This endpoint is on the dashboard API, not the main API
      // You may need to adjust the URL based on your magneteco setup
      const dashboardUrl = baseUrl!.replace('/v1', '').replace('api.', 'dashboard.');
      const configResponse = await fetch(
        `${dashboardUrl}/api/apps/${appId}/domain-config`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${dashboardToken}`,
          },
          body: JSON.stringify(domainConfig),
        }
      );

      if (!configResponse.ok) {
        const error = await configResponse.text();
        throw new Error(`Failed to register config: ${configResponse.status} - ${error}`);
      }

      console.log('   ✅ Domain configuration registered!\n');
    } catch (error) {
      console.error(`   ⚠️  Could not register domain config: ${error}`);
      console.log('   📝 You can manually configure this in the Magneteco dashboard.\n');
    }
  } else {
    console.log('2️⃣  Skipping domain config registration (no MAGNETECO_DASHBOARD_TOKEN)');
    console.log('   📝 Configure manually at: https://dashboard.magneteco.io/domain-config\n');
  }

  // Step 3: Print configuration summary
  console.log('3️⃣  Configuration Summary:\n');

  const config = createGlapiDomainConfig(appId!);
  console.log(`   App ID: ${config.appId}`);
  console.log(`   Name: ${config.name}`);
  console.log(`   Categories: ${config.categories.length}`);
  config.categories.forEach((c) => console.log(`     - ${c.name}`));
  console.log(`   Entity Types: ${config.entityTypes?.length || 0}`);
  config.entityTypes?.forEach((e) => console.log(`     - ${e.name}`));
  console.log(`   Relationship Types: ${config.relationshipTypes?.length || 0}`);
  console.log(`   Relevance Rules: ${config.relevanceRules?.length || 0}`);
  console.log(`   Retention: ${config.retentionDays} days`);

  console.log('\n✅ Setup complete!\n');
  console.log('Next steps:');
  console.log('  1. Add MAGNETECO_URL and MAGNETECO_API_KEY to your production .env');
  console.log('  2. The memory service will automatically activate when credentials are present');
  console.log('  3. Chat conversations will now build persistent memory per user');
}

main().catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
});
