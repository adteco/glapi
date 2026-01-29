/**
 * Minimal route status smoke tests.
 *
 * Verifies authenticated user can load:
 * - Home (/)
 * - Dashboard (/dashboard)
 */

import { test, expect } from '@playwright/test';
import { authAssertions } from './helpers/assertions';

test.describe('Route status', () => {
  test('home returns 200 for authenticated user', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });

    expect(response, 'home should return a response').not.toBeNull();
    expect(response?.status(), 'home should return 200').toBe(200);

    await expect(page).not.toHaveURL(/sign-in/);
  });

  test('dashboard returns 200 for authenticated user', async ({ page }) => {
    const response = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    expect(response, 'dashboard should return a response').not.toBeNull();
    expect(response?.status(), 'dashboard should return 200').toBe(200);

    await expect(page).not.toHaveURL(/sign-in/);
    await authAssertions.expectAuthenticated(page);
  });
});
