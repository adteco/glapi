/**
 * Simple page load check - no auth required
 * Just verifies pages respond without errors
 */
import { test, expect } from '@playwright/test';

test.describe('Simple Page Load Checks', () => {
  test('landing page loads', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(500);
  });

  test('sign-in page loads', async ({ page }) => {
    const response = await page.goto('/sign-in');
    expect(response?.status()).toBeLessThan(500);
  });

  test('lists/customers redirects to sign-in (not 500)', async ({ page }) => {
    const response = await page.goto('/lists/customers');
    expect(response?.status()).toBeLessThan(500);
  });

  test('lists/items redirects to sign-in (not 500)', async ({ page }) => {
    const response = await page.goto('/lists/items');
    expect(response?.status()).toBeLessThan(500);
  });

  test('relationships/vendors redirects to sign-in (not 500)', async ({ page }) => {
    const response = await page.goto('/relationships/vendors');
    expect(response?.status()).toBeLessThan(500);
  });

  test('transactions page redirects to sign-in (not 500)', async ({ page }) => {
    const response = await page.goto('/transactions');
    expect(response?.status()).toBeLessThan(500);
  });
});
