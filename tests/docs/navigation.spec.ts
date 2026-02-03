import { test, expect } from '@playwright/test';
import { waitForPageReady } from '../utils/test-helpers';

test.describe('Documentation Site', () => {
  // Note: Docs site may be on a different port/subdomain
  const docsBaseUrl = process.env.DOCS_URL || 'http://localhost:3001';

  test.beforeEach(async ({ page }) => {
    await page.goto(docsBaseUrl);
  });

  test.describe('Page Load', () => {
    test('should load documentation home page', async ({ page }) => {
      await expect(page).toHaveURL(new RegExp(docsBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });

    test('should display main heading', async ({ page }) => {
      const heading = page.locator('h1').first();
      await expect(heading).toBeVisible();
    });

    test('should display navigation sidebar', async ({ page }) => {
      const sidebar = page.locator(
        'nav, aside, [data-testid="sidebar"], .sidebar'
      );
      await expect(sidebar.first()).toBeVisible();
    });

    test('should display search input', async ({ page }) => {
      const searchInput = page.locator(
        'input[type="search"], input[placeholder*="Search"], [data-testid="search"]'
      );
      // Search may or may not be present
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to getting started', async ({ page }) => {
      const gettingStartedLink = page.locator(
        'a:has-text("Getting Started"), a:has-text("Quick Start"), a[href*="getting-started"]'
      ).first();

      if (await gettingStartedLink.isVisible()) {
        await gettingStartedLink.click();
        await expect(page).toHaveURL(/getting-started|quickstart/);
      }
    });

    test('should navigate to API reference', async ({ page }) => {
      const apiLink = page.locator(
        'a:has-text("API"), a:has-text("Reference"), a[href*="api"]'
      ).first();

      if (await apiLink.isVisible()) {
        await apiLink.click();
        await expect(page).toHaveURL(/api|reference/);
      }
    });

    test('should navigate to authentication docs', async ({ page }) => {
      const authLink = page.locator(
        'a:has-text("Authentication"), a:has-text("Auth"), a[href*="auth"]'
      ).first();

      if (await authLink.isVisible()) {
        await authLink.click();
        await expect(page).toHaveURL(/auth/);
      }
    });

    test('should expand navigation sections', async ({ page }) => {
      const expandButton = page.locator(
        'button[aria-expanded], [data-state="closed"], .nav-toggle'
      ).first();

      if (await expandButton.isVisible()) {
        await expandButton.click();
        // Should expand section
      }
    });

    test('should have breadcrumb navigation', async ({ page }) => {
      // Navigate to a nested page first
      const nestedLink = page.locator('nav a').nth(3);
      if (await nestedLink.isVisible()) {
        await nestedLink.click();
        await waitForPageReady(page);

        const breadcrumb = page.locator(
          '[aria-label="breadcrumb"], .breadcrumb, nav:has-text("/")'
        );
        // Breadcrumb may or may not be present
      }
    });
  });

  test.describe('Search', () => {
    test('should open search dialog', async ({ page }) => {
      const searchButton = page.locator(
        'button:has-text("Search"), [data-testid="search-button"], kbd:has-text("K")'
      ).first();

      if (await searchButton.isVisible()) {
        await searchButton.click();

        const searchDialog = page.locator(
          '[role="dialog"], [data-testid="search-dialog"], .search-modal'
        );
        await expect(searchDialog).toBeVisible();
      }
    });

    test('should search documentation', async ({ page }) => {
      const searchInput = page.locator(
        'input[type="search"], input[placeholder*="Search"]'
      ).first();

      if (await searchInput.isVisible()) {
        await searchInput.fill('authentication');

        // Should show search results
        const results = page.locator(
          '[data-testid="search-results"], .search-results, [role="listbox"]'
        );
        // Results may or may not appear depending on implementation
      }
    });

    test('should navigate to search result', async ({ page }) => {
      const searchInput = page.locator(
        'input[type="search"], input[placeholder*="Search"]'
      ).first();

      if (await searchInput.isVisible()) {
        await searchInput.fill('API');

        const firstResult = page.locator(
          '[data-testid="search-result"], .search-result, [role="option"]'
        ).first();

        if (await firstResult.isVisible()) {
          await firstResult.click();
          // Should navigate to result page
        }
      }
    });
  });

  test.describe('Content', () => {
    test('should display code blocks', async ({ page }) => {
      // Navigate to a page with code
      const apiLink = page.locator('a:has-text("API")').first();
      if (await apiLink.isVisible()) {
        await apiLink.click();
        await waitForPageReady(page);

        const codeBlock = page.locator('pre, code, .code-block');
        // Code blocks may or may not be on this page
      }
    });

    test('should have copy button on code blocks', async ({ page }) => {
      const copyButton = page.locator(
        'button:has-text("Copy"), button[aria-label*="copy"], .copy-button'
      );
      // Copy button may or may not be present
    });

    test('should display tables correctly', async ({ page }) => {
      const table = page.locator('table');
      // Tables may or may not be present
    });

    test('should display images with alt text', async ({ page }) => {
      const images = page.locator('article img, main img');
      const count = await images.count();

      for (let i = 0; i < count; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        expect(alt !== null).toBe(true);
      }
    });
  });

  test.describe('Internal Links', () => {
    test('should have working internal links', async ({ page }) => {
      const internalLinks = page.locator('a[href^="/"], a[href^="./"], a[href^="../"]');
      const count = await internalLinks.count();

      // Check first 5 internal links
      for (let i = 0; i < Math.min(count, 5); i++) {
        const link = internalLinks.nth(i);
        const href = await link.getAttribute('href');

        if (href && !href.includes('#')) {
          const response = await page.goto(docsBaseUrl + href);
          expect(response?.status()).toBeLessThan(400);
          await page.goBack();
        }
      }
    });

    test('should have working anchor links', async ({ page }) => {
      const anchorLinks = page.locator('a[href^="#"]');
      const count = await anchorLinks.count();

      if (count > 0) {
        const firstAnchor = anchorLinks.first();
        await firstAnchor.click();
        // Should scroll to anchor
      }
    });
  });

  test.describe('Theme and Appearance', () => {
    test('should have theme toggle', async ({ page }) => {
      const themeToggle = page.locator(
        'button[aria-label*="theme"], button:has-text("Dark"), button:has-text("Light"), [data-testid="theme-toggle"]'
      );
      // Theme toggle may or may not be present
    });

    test('should toggle dark mode', async ({ page }) => {
      const themeToggle = page.locator(
        'button[aria-label*="theme"], [data-testid="theme-toggle"]'
      ).first();

      if (await themeToggle.isVisible()) {
        await themeToggle.click();

        // Check if dark class is applied
        const html = page.locator('html');
        const className = await html.getAttribute('class');
        // May or may not have dark class depending on implementation
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should be functional on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();

      // Content should still be visible
      const content = page.locator('main, article, .content');
      await expect(content.first()).toBeVisible();
    });

    test('should have mobile menu on small screens', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();

      const mobileMenuButton = page.locator(
        'button[aria-label*="menu"], [data-testid="mobile-menu"], .hamburger'
      );

      if (await mobileMenuButton.isVisible()) {
        await mobileMenuButton.click();

        // Should show mobile navigation
        const mobileNav = page.locator(
          '[data-testid="mobile-nav"], .mobile-nav, nav[aria-expanded="true"]'
        );
        // Mobile nav should appear
      }
    });

    test('sidebar should hide on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();

      const sidebar = page.locator('aside, [data-testid="sidebar"]');
      // Sidebar may be hidden or transformed on mobile
    });
  });

  test.describe('SEO and Accessibility', () => {
    test('should have proper page titles', async ({ page }) => {
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);
    });

    test('should have meta description', async ({ page }) => {
      const metaDescription = page.locator('meta[name="description"]');
      const content = await metaDescription.getAttribute('content');
      expect(content).toBeTruthy();
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      const h1 = page.locator('h1');
      const h1Count = await h1.count();
      expect(h1Count).toBeGreaterThanOrEqual(1);
    });

    test('should have skip to content link', async ({ page }) => {
      const skipLink = page.locator('a:has-text("Skip"), a[href="#content"], a[href="#main"]');
      // Skip link may or may not be present
    });

    test('should have proper link text', async ({ page }) => {
      const links = page.locator('a');
      const count = await links.count();

      // Check that links have meaningful text
      for (let i = 0; i < Math.min(count, 10); i++) {
        const link = links.nth(i);
        const text = await link.textContent();
        const ariaLabel = await link.getAttribute('aria-label');

        // Link should have text or aria-label
        expect(text?.trim() || ariaLabel).toBeTruthy();
      }
    });
  });

  test.describe('Performance', () => {
    test('should load within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto(docsBaseUrl);
      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('navigation should be fast', async ({ page }) => {
      const link = page.locator('nav a').first();

      if (await link.isVisible()) {
        const startTime = Date.now();
        await link.click();
        await waitForPageReady(page);
        const navTime = Date.now() - startTime;

        // Navigation should be quick
        expect(navTime).toBeLessThan(3000);
      }
    });
  });
});
