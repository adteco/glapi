#!/usr/bin/env node

/**
 * Test script for accounting periods creation after database migration
 * Tests the TRPC createFiscalYear endpoint
 */

const https = require('https');
const http = require('http');

const API_URL = 'http://localhost:3031';
const ENDPOINT = '/api/trpc/accountingPeriods.createFiscalYear';

// Test data - create fiscal year periods for 2025
const testData = {
    subsidiaryId: '00000000-0000-0000-0000-000000000001', // Will be replaced with actual
    fiscalYear: '2025',
    startMonth: 1,
    yearStartDate: '2025-01-01',
    includeAdjustmentPeriod: true
};

// Default org and user for development context
const DEV_ORG_ID = 'ba3b8cdf-efc1-4a60-88be-ac203d263fe2';
const DEV_USER_ID = 'user_development';

async function makeRequest(url, method, data, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        if (data) {
            options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
        }

        const client = urlObj.protocol === 'https:' ? https : http;
        const req = client.request(options, (res) => {
            let body = '';

            res.on('data', (chunk) => {
                body += chunk;
            });

            res.on('end', () => {
                try {
                    const response = {
                        status: res.statusCode,
                        headers: res.headers,
                        body: body ? JSON.parse(body) : null
                    };
                    resolve(response);
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: body
                    });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function testAccountingPeriods() {
    console.log('Testing Accounting Periods Creation');
    console.log('====================================\n');

    // Step 1: Get subsidiaries
    console.log('Step 1: Fetching subsidiaries...');
    try {
        const subsidiariesUrl = `${API_URL}/api/subsidiaries`;
        const subsidiariesResponse = await makeRequest(subsidiariesUrl, 'GET', null, {
            'x-organization-id': DEV_ORG_ID,
            'x-user-id': DEV_USER_ID
        });

        if (subsidiariesResponse.status !== 200) {
            console.error('Failed to fetch subsidiaries:', subsidiariesResponse.status);
            console.error('Response:', JSON.stringify(subsidiariesResponse.body, null, 2));
            return;
        }

        const subsidiaries = subsidiariesResponse.body;
        console.log(`Found ${subsidiaries.length} subsidiary(ies)`);

        if (subsidiaries.length === 0) {
            console.error('No subsidiaries found. Please create a subsidiary first.');
            return;
        }

        // Use first subsidiary
        const subsidiary = subsidiaries[0];
        console.log(`Using subsidiary: ${subsidiary.name} (${subsidiary.id})\n`);
        testData.subsidiaryId = subsidiary.id;

    } catch (error) {
        console.error('Error fetching subsidiaries:', error.message);
        return;
    }

    // Step 2: Create fiscal year periods
    console.log('Step 2: Creating fiscal year periods...');
    console.log('Input data:', JSON.stringify(testData, null, 2));

    try {
        // TRPC batch=1 format
        const trpcUrl = `${API_URL}${ENDPOINT}?batch=1&input=${encodeURIComponent(JSON.stringify({ 0: testData }))}`;

        console.log('Calling TRPC endpoint:', trpcUrl);

        const response = await makeRequest(trpcUrl, 'GET', null, {
            'x-organization-id': DEV_ORG_ID,
            'x-user-id': DEV_USER_ID
        });

        console.log('\nResponse Status:', response.status);
        console.log('Response Body:', JSON.stringify(response.body, null, 2));

        if (response.status === 200 && response.body && response.body[0] && response.body[0].result) {
            const periods = response.body[0].result.data;
            console.log('\n✅ SUCCESS! Created fiscal year periods:');
            console.log(`   Created ${periods.length} periods`);
            periods.forEach(p => {
                console.log(`   - ${p.periodName} (${p.startDate} to ${p.endDate}) - ${p.status}`);
            });

            // Test passed
            process.exit(0);
        } else if (response.body && response.body[0] && response.body[0].error) {
            console.error('\n❌ FAILED with error:');
            console.error('   Code:', response.body[0].error.code);
            console.error('   Message:', response.body[0].error.message);
            if (response.body[0].error.data) {
                console.error('   Data:', JSON.stringify(response.body[0].error.data, null, 2));
            }

            // Test failed
            process.exit(1);
        } else {
            console.error('\n❌ FAILED: Unexpected response format');

            // Test failed
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ FAILED with exception:');
        console.error('   Error:', error.message);
        console.error('   Stack:', error.stack);

        // Test failed
        process.exit(1);
    }
}

// Run the test
testAccountingPeriods().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
