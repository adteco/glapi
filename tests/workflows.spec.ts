import { expect, test } from '@playwright/test';

test.describe('Workflows', () => {
  test('loads the workflow builder without workflows.list server errors', async ({ page }) => {
    const workflowStatuses: number[] = [];

    page.on('response', (response) => {
      if (response.url().includes('/api/trpc/workflows.list')) {
        workflowStatuses.push(response.status());
      }
    });

    await page.goto('/admin/settings/workflows');
    await expect(page.getByRole('heading', { name: 'Workflow Builder' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    await expect
      .poll(() => workflowStatuses.length, { message: 'Expected workflows.list to be requested' })
      .toBeGreaterThan(0);

    expect(workflowStatuses.every((status) => status === 200)).toBe(true);
  });
});
