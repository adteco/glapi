// Test accounting periods wizard - connects to existing Chrome via CDP
import { chromium } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3030';

// Try to connect to existing Chrome (must be launched with --remote-debugging-port=9222)
// Or launch a new browser with temporary profile
const CONNECT_TO_EXISTING = process.env.CONNECT_TO_CHROME === 'true';

(async () => {
  console.log('🧪 Testing Accounting Periods Wizard');
  console.log(`   Base URL: ${baseUrl}\n`);

  let browser;
  let context;
  let page;

  if (CONNECT_TO_EXISTING) {
    // Connect to existing Chrome instance
    console.log('📡 Connecting to existing Chrome (port 9222)...');
    browser = await chromium.connectOverCDP('http://localhost:9222');
    context = browser.contexts()[0];
    page = context.pages()[0] || await context.newPage();
  } else {
    // Launch new browser - user will need to log in manually
    console.log('🚀 Launching new Chrome browser...');
    console.log('   ⚠️  You may need to log in manually if not authenticated\n');
    browser = await chromium.launch({
      headless: false,
      channel: 'chrome',
    });
    context = await browser.newContext();
    page = await context.newPage();
  }

  try {
    // Navigate to accounting periods page
    console.log('📍 Navigating to /lists/accounting-periods...');
    await page.goto(`${baseUrl}/lists/accounting-periods`, { waitUntil: 'networkidle' });

    // Check if we're on a login page
    const url = page.url();
    if (url.includes('sign-in') || url.includes('login')) {
      console.log('\n⚠️  Redirected to login page. You need to authenticate first.');
      console.log('   Options:');
      console.log('   1. Close all Chrome instances and run: pnpm playwright:profile');
      console.log('   2. Or launch Chrome with: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
      console.log('      Then run: CONNECT_TO_CHROME=true node scripts/test-accounting-periods.mjs\n');
      await page.pause(); // Let user log in manually
    }

    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/01-initial.png' });
    console.log('   Screenshot saved: test-results/01-initial.png');

    // Look for Create Fiscal Year button
    console.log('🔍 Looking for Create Fiscal Year button...');
    const createButton = page.getByRole('button', { name: /create fiscal year/i });

    if (await createButton.isVisible({ timeout: 5000 })) {
      console.log('   ✅ Found Create Fiscal Year button');
      await createButton.click();
      await page.waitForTimeout(500);

      // Screenshot of wizard dialog
      await page.screenshot({ path: 'test-results/02-wizard-dialog.png' });
      console.log('   Screenshot saved: test-results/02-wizard-dialog.png');

      // Fill the wizard form
      console.log('📝 Filling wizard form...');

      // Select subsidiary (click the select trigger first)
      const subSelect = page.locator('button[role="combobox"]').first();
      if (await subSelect.isVisible()) {
        await subSelect.click();
        await page.waitForTimeout(300);
        // Select first option
        await page.locator('[role="option"]').first().click();
        console.log('   ✅ Selected subsidiary');
      }

      // Fill fiscal year
      const fiscalYearInput = page.locator('input[name="fiscalYear"]');
      if (await fiscalYearInput.isVisible()) {
        await fiscalYearInput.clear();
        await fiscalYearInput.fill('2026');
        console.log('   ✅ Filled fiscal year: 2026');
      }

      // Fill year start date
      const startDateInput = page.locator('input[name="yearStartDate"]');
      if (await startDateInput.isVisible()) {
        await startDateInput.clear();
        await startDateInput.fill('2026-01-01');
        console.log('   ✅ Filled start date: 2026-01-01');
      }

      // Screenshot before submit
      await page.screenshot({ path: 'test-results/03-form-filled.png' });
      console.log('   Screenshot saved: test-results/03-form-filled.png');

      // Submit the form
      console.log('🚀 Submitting form...');
      const submitButton = page.getByRole('button', { name: /create.*period|submit|generate/i });
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Wait for response
        console.log('   Waiting for response...');
        await page.waitForTimeout(3000);

        // Screenshot of result
        await page.screenshot({ path: 'test-results/04-result.png' });
        console.log('   Screenshot saved: test-results/04-result.png');

        // Check for errors
        const errorAlert = page.locator('[role="alert"], .text-red-500, .text-destructive');
        if (await errorAlert.isVisible()) {
          const errorText = await errorAlert.textContent();
          console.log(`\n❌ ERROR: ${errorText}`);
        } else {
          // Check for success indicators
          const periodRows = page.locator('table tbody tr, [data-testid="period-row"]');
          const count = await periodRows.count();

          if (count > 0) {
            console.log(`\n✅ SUCCESS! Created ${count} accounting periods`);
          } else {
            // Check for success toast/message
            const successMsg = page.locator('text=/success|created/i');
            if (await successMsg.isVisible()) {
              console.log('\n✅ SUCCESS! Periods created');
            } else {
              console.log('\n⚠️  Form submitted but no clear success/error indicator found');
              console.log('   Check the screenshots for the actual result');
            }
          }
        }
      } else {
        console.log('   ⚠️  Submit button not found');
      }
    } else {
      console.log('   ⚠️  Create Fiscal Year button not visible');
      console.log('   Page might still be loading or you need to authenticate');
      await page.screenshot({ path: 'test-results/01-no-button.png' });

      // Pause to let user see what's happening
      console.log('\n   Pausing for inspection...');
      await page.pause();
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: 'test-results/error.png' });
    console.log('   Error screenshot saved: test-results/error.png');
  } finally {
    console.log('\n📋 Test complete. Check screenshots in test-results/');
    if (!CONNECT_TO_EXISTING) {
      await browser.close();
    }
  }
})().catch((error) => {
  console.error('Failed to run test:', error);
  process.exit(1);
});
