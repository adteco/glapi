import { test, expect } from '@playwright/test';
import { ListPage, DialogPage } from '../pages';

test.describe('Contacts (smoke)', () => {
  let listPage: ListPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/relationships/contacts');
    await listPage.waitForPageLoad();
  });

  test('should load contacts list page', async ({ page }) => {
    await expect(page).toHaveURL(/\/relationships\/contacts/);
  });

  test('should display contacts table or empty state', async () => {
    const hasRows = (await listPage.getRowCount()) > 0;
    const isEmpty = await listPage.isEmpty();
    expect(hasRows || isEmpty).toBe(true);
  });

  test('should open and close create dialog', async () => {
    await listPage.clickCreate();

    const dialogOpened = await dialogPage.isOpen();
    expect(dialogOpened).toBe(true);

    await dialogPage.cancel();
    await dialogPage.expectNotVisible();
  });
});
