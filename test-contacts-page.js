const puppeteer = require('puppeteer');

async function testContactsPage() {
  const browser = await puppeteer.launch({
    headless: false, // Set to true if you don't want to see the browser
    devtools: true
  });

  try {
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      console.log('Browser console:', msg.type(), msg.text());
    });
    
    // Log any page errors
    page.on('pageerror', error => {
      console.error('Page error:', error.message);
    });

    // Navigate to the contacts page
    console.log('Navigating to contacts page...');
    await page.goto('http://localhost:3000/relationships/contacts', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for the page to load
    await page.waitForTimeout(2000);

    // Take a screenshot
    await page.screenshot({ 
      path: 'contacts-page.png',
      fullPage: true 
    });
    console.log('Screenshot saved as contacts-page.png');

    // Check if there are any errors on the page
    const errors = await page.evaluate(() => {
      const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"]');
      return Array.from(errorElements).map(el => el.textContent);
    });

    if (errors.length > 0) {
      console.log('Errors found on page:', errors);
    }

    // Try to click the "Add Contact" button if it exists
    const addButtonExists = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button')).find(
        btn => btn.textContent.includes('Add Contact')
      );
      return !!button;
    });

    if (addButtonExists) {
      console.log('Add Contact button found');
      await page.click('button:has-text("Add Contact")');
      await page.waitForTimeout(1000);
      
      // Take screenshot of the form
      await page.screenshot({ 
        path: 'contacts-form.png',
        fullPage: true 
      });
      console.log('Form screenshot saved as contacts-form.png');
    }

    // Get page content for debugging
    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);

    // Check for loading states
    const isLoading = await page.evaluate(() => {
      return document.body.textContent.includes('Loading...');
    });
    console.log('Page is loading:', isLoading);

    // Check for any table data
    const tableData = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      return rows.length;
    });
    console.log('Number of table rows:', tableData);

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    // Keep browser open for manual inspection
    console.log('\nPress Ctrl+C to close the browser...');
    // Uncomment the next line to auto-close
    // await browser.close();
  }
}

// Run the test
testContactsPage();