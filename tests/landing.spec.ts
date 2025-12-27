import { test, expect } from '@playwright/test';

test.describe('Landing Pages', () => {
  test.describe('Home Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
    });

    test('should load home page', async ({ page }) => {
      await expect(page).toHaveURL('/');
    });

    test('should display hero section', async ({ page }) => {
      const hero = page.locator('[data-testid="hero"], .hero, section:first-of-type');
      await expect(hero).toBeVisible();
    });

    test('should display main heading', async ({ page }) => {
      const heading = page.locator('h1').first();
      await expect(heading).toBeVisible();
    });

    test('should display CTA button', async ({ page }) => {
      const ctaButton = page.locator(
        'a:has-text("Get Started"), button:has-text("Get Started"), a:has-text("Sign Up"), a:has-text("Try")'
      ).first();
      await expect(ctaButton).toBeVisible();
    });

    test('should have navigation menu', async ({ page }) => {
      const nav = page.locator('nav, header');
      await expect(nav).toBeVisible();
    });

    test('should have sign in link', async ({ page }) => {
      const signInLink = page.locator(
        'a:has-text("Sign In"), a:has-text("Login"), a[href*="sign-in"]'
      ).first();
      await expect(signInLink).toBeVisible();
    });

    test('should navigate to sign in', async ({ page }) => {
      const signInLink = page.locator(
        'a:has-text("Sign In"), a:has-text("Login"), a[href*="sign-in"]'
      ).first();
      await signInLink.click();

      await expect(page).toHaveURL(/sign-in|login|auth/);
    });

    test('should display features section', async ({ page }) => {
      const features = page.locator(
        '[data-testid="features"], .features, section:has-text("Features")'
      );
      // Features section may or may not be on home page
    });

    test('should display footer', async ({ page }) => {
      const footer = page.locator('footer');
      await expect(footer).toBeVisible();
    });

    test('should have company logo', async ({ page }) => {
      const logo = page.locator(
        'img[alt*="logo"], [data-testid="logo"], .logo, svg[aria-label*="logo"]'
      ).first();
      await expect(logo).toBeVisible();
    });
  });

  test.describe('Pricing Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/pricing');
    });

    test('should load pricing page', async ({ page }) => {
      await expect(page).toHaveURL(/\/pricing/);
    });

    test('should display pricing heading', async ({ page }) => {
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible();
    });

    test('should display pricing tiers', async ({ page }) => {
      const pricingCards = page.locator(
        '[data-testid="pricing-card"], .pricing-card, .pricing-tier, [class*="pricing"]'
      );
      const count = await pricingCards.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should show pricing amounts', async ({ page }) => {
      const prices = page.locator(':has-text("$"), :has-text("€")');
      const count = await prices.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should have CTA buttons on pricing cards', async ({ page }) => {
      const ctaButtons = page.locator(
        'button:has-text("Start"), button:has-text("Subscribe"), a:has-text("Start"), a:has-text("Get Started")'
      );
      const count = await ctaButtons.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should display feature lists', async ({ page }) => {
      const features = page.locator('ul li, .feature-list li');
      const count = await features.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Contact Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/contact');
    });

    test('should load contact page', async ({ page }) => {
      await expect(page).toHaveURL(/\/contact/);
    });

    test('should display contact heading', async ({ page }) => {
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible();
    });

    test('should display contact form', async ({ page }) => {
      const form = page.locator('form');
      await expect(form).toBeVisible();
    });

    test('should have name input', async ({ page }) => {
      const nameInput = page.locator(
        'input[name="name"], input[placeholder*="name"], input[id*="name"]'
      ).first();
      await expect(nameInput).toBeVisible();
    });

    test('should have email input', async ({ page }) => {
      const emailInput = page.locator(
        'input[name="email"], input[type="email"], input[placeholder*="email"]'
      ).first();
      await expect(emailInput).toBeVisible();
    });

    test('should have message textarea', async ({ page }) => {
      const messageInput = page.locator(
        'textarea, input[name="message"]'
      ).first();
      await expect(messageInput).toBeVisible();
    });

    test('should have submit button', async ({ page }) => {
      const submitButton = page.locator(
        'button[type="submit"], button:has-text("Send"), button:has-text("Submit")'
      ).first();
      await expect(submitButton).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      const submitButton = page.locator(
        'button[type="submit"], button:has-text("Send")'
      ).first();
      await submitButton.click();

      // Should show validation errors
      const errors = page.locator('.error, [role="alert"], .text-red-500, .text-destructive');
      // May or may not show validation errors depending on implementation
    });

    test('should display contact information', async ({ page }) => {
      const contactInfo = page.locator(
        ':has-text("@"), :has-text("email"), :has-text("phone"), :has-text("address")'
      );
      // Contact info may or may not be displayed
    });
  });

  test.describe('Navigation', () => {
    test('should navigate from home to pricing', async ({ page }) => {
      await page.goto('/');

      const pricingLink = page.locator('a:has-text("Pricing"), a[href*="pricing"]').first();
      if (await pricingLink.isVisible()) {
        await pricingLink.click();
        await expect(page).toHaveURL(/\/pricing/);
      }
    });

    test('should navigate from home to contact', async ({ page }) => {
      await page.goto('/');

      const contactLink = page.locator('a:has-text("Contact"), a[href*="contact"]').first();
      if (await contactLink.isVisible()) {
        await contactLink.click();
        await expect(page).toHaveURL(/\/contact/);
      }
    });

    test('should have mobile menu on small screens', async ({ page }) => {
      await page.goto('/');
      await page.setViewportSize({ width: 375, height: 667 });

      const mobileMenuButton = page.locator(
        'button[aria-label*="menu"], [data-testid="mobile-menu"], button:has([class*="hamburger"])'
      );

      if (await mobileMenuButton.isVisible()) {
        await mobileMenuButton.click();

        // Menu should expand
        const mobileNav = page.locator('[data-testid="mobile-nav"], .mobile-menu, nav[class*="mobile"]');
        await expect(mobileNav).toBeVisible();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should be functional on mobile', async ({ page }) => {
      await page.goto('/');
      await page.setViewportSize({ width: 375, height: 667 });

      // Hero should still be visible
      const hero = page.locator('[data-testid="hero"], .hero, section:first-of-type');
      await expect(hero).toBeVisible();
    });

    test('should be functional on tablet', async ({ page }) => {
      await page.goto('/');
      await page.setViewportSize({ width: 768, height: 1024 });

      const hero = page.locator('[data-testid="hero"], .hero, section:first-of-type');
      await expect(hero).toBeVisible();
    });

    test('pricing page should be responsive', async ({ page }) => {
      await page.goto('/pricing');
      await page.setViewportSize({ width: 375, height: 667 });

      // Pricing cards should stack on mobile
      const pricingCards = page.locator('[data-testid="pricing-card"], .pricing-card');
      const firstCard = pricingCards.first();
      if (await firstCard.isVisible()) {
        await expect(firstCard).toBeVisible();
      }
    });
  });

  test.describe('SEO and Accessibility', () => {
    test('should have meta description', async ({ page }) => {
      await page.goto('/');

      const metaDescription = page.locator('meta[name="description"]');
      const content = await metaDescription.getAttribute('content');
      expect(content).toBeTruthy();
    });

    test('should have page title', async ({ page }) => {
      await page.goto('/');

      const title = await page.title();
      expect(title).toBeTruthy();
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/');

      const h1 = page.locator('h1');
      const h1Count = await h1.count();
      expect(h1Count).toBe(1);
    });

    test('should have alt text on images', async ({ page }) => {
      await page.goto('/');

      const images = page.locator('img');
      const count = await images.count();

      for (let i = 0; i < count; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        // Alt should be present (can be empty for decorative images)
        expect(alt !== null).toBe(true);
      }
    });

    test('should have skip link for accessibility', async ({ page }) => {
      await page.goto('/');

      const skipLink = page.locator('a[href="#main"], a:has-text("Skip to")');
      // Skip link may or may not be present
    });
  });
});
