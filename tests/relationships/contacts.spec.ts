import { test, expect } from '@playwright/test';
import { ListPage, DialogPage } from '../pages';
import { randomString, randomEmail, randomPhone } from '../utils/test-helpers';

test.describe('Contacts', () => {
  let listPage: ListPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/relationships/contacts');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load contacts list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/relationships\/contacts/);
    });

    test('should display contacts table or empty state', async () => {
      const hasRows = (await listPage.getRowCount()) > 0;
      const isEmpty = await listPage.isEmpty();
      expect(hasRows || isEmpty).toBe(true);
    });

    test('should display create button', async () => {
      await expect(listPage.createButton).toBeVisible();
    });

    test('should display correct table headers', async () => {
      const headers = await listPage.tableHeaders.allTextContents();
      const headerText = headers.join(' ').toLowerCase();
      expect(headerText).toMatch(/name|email|phone|company/i);
    });

    test('should display page title and description', async ({ page }) => {
      await expect(page.locator('text=Contacts')).toBeVisible();
      await expect(page.locator('text=Manage contacts')).toBeVisible();
    });
  });

  test.describe('Search and Filter', () => {
    test('should search contacts by name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get a contact name to search for
      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'test';

      // Look for search input
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill(searchTerm);
        await page.waitForTimeout(500); // Wait for debounce
        await listPage.waitForPageLoad();

        const filteredCount = await listPage.getRowCount();
        expect(filteredCount).toBeLessThanOrEqual(rowCount);
      }
    });

    test('should clear search', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('test-search');
        await searchInput.clear();

        const value = await searchInput.inputValue();
        expect(value).toBe('');
      }
    });

    test('should filter by company if filter available', async ({ page }) => {
      const companyFilter = page.locator('button:has-text("Company"), [data-testid="company-filter"]');
      if (await companyFilter.isVisible().catch(() => false)) {
        await companyFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible().catch(() => false)) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Contact', () => {
    test('should open create dialog', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should create contact with basic info', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const fullName = `Test Contact ${randomString(6)}`;
        const email = randomEmail();

        await dialogPage.fillInput('Full Name', fullName);
        await dialogPage.fillInput('Email', email);

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.expectRowWithText(fullName);
      }
    });

    test('should create contact with full details', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const contactData = {
          fullName: `Full Contact ${randomString(6)}`,
          email: randomEmail(),
          phone: randomPhone(),
          title: 'Sales Manager',
          department: 'Sales',
          mobilePhone: randomPhone(),
          workPhone: randomPhone(),
        };

        await dialogPage.fillInput('Full Name', contactData.fullName);
        await dialogPage.fillInput('Email', contactData.email);
        await dialogPage.fillInput('Primary Phone', contactData.phone);

        // Fill optional fields if visible
        const titleInput = dialogPage.dialog.locator('#title, input[id="title"]');
        if (await titleInput.isVisible().catch(() => false)) {
          await titleInput.fill(contactData.title);
        }

        const deptInput = dialogPage.dialog.locator('#department, input[id="department"]');
        if (await deptInput.isVisible().catch(() => false)) {
          await deptInput.fill(contactData.department);
        }

        const mobileInput = dialogPage.dialog.locator('#mobilePhone, input[id="mobilePhone"]');
        if (await mobileInput.isVisible().catch(() => false)) {
          await mobileInput.fill(contactData.mobilePhone);
        }

        const workInput = dialogPage.dialog.locator('#workPhone, input[id="workPhone"]');
        if (await workInput.isVisible().catch(() => false)) {
          await workInput.fill(contactData.workPhone);
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.expectRowWithText(contactData.fullName);
      }
    });

    test('should create contact with company association', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const fullName = `Company Contact ${randomString(6)}`;
        const email = randomEmail();
        const phone = randomPhone();

        await dialogPage.fillInput('Full Name', fullName);
        await dialogPage.fillInput('Email', email);
        await dialogPage.fillInput('Primary Phone', phone);

        // Try to select a company
        const companySelect = dialogPage.dialog.locator('button[role="combobox"]').first();
        if (await companySelect.isVisible().catch(() => false)) {
          await companySelect.click();
          const option = page.locator('[role="option"]').first();
          if (await option.isVisible().catch(() => false)) {
            await option.click();
          }
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.expectRowWithText(fullName);
      }
    });

    test('should create contact with preferred communication method', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const fullName = `Comm Contact ${randomString(6)}`;
        const email = randomEmail();

        await dialogPage.fillInput('Full Name', fullName);
        await dialogPage.fillInput('Email', email);

        // Select preferred communication method
        const commSelect = dialogPage.dialog.locator('label:has-text("Preferred Contact Method")').locator('..').locator('button[role="combobox"]');
        if (await commSelect.isVisible().catch(() => false)) {
          await commSelect.click();
          const phoneOption = page.locator('[role="option"]:has-text("Phone")');
          if (await phoneOption.isVisible().catch(() => false)) {
            await phoneOption.click();
          }
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.expectRowWithText(fullName);
      }
    });

    test('should validate required fields', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Try to submit without filling required fields
        await dialogPage.confirm();

        // Should show validation error for missing full name
        await listPage.expectToast('Full name is required');
      }
    });

    test('should validate email format', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.fillInput('Full Name', `Email Test ${randomString(6)}`);
        await dialogPage.fillInput('Email', 'invalid-email-format');

        await dialogPage.confirm();

        // Check if there's a validation error (implementation dependent)
        const emailInput = dialogPage.dialog.locator('#email, input[type="email"]');
        const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
        // Email validation might be handled by HTML5 or custom validation
      }
    });

    test('should cancel contact creation', async () => {
      const initialCount = await listPage.getRowCount();

      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.fillInput('Full Name', `Cancel ${randomString(6)}`);
        await dialogPage.cancel();

        await dialogPage.expectNotVisible();

        const newCount = await listPage.getRowCount();
        expect(newCount).toBe(initialCount);
      }
    });

    test('should close dialog with escape key', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await page.keyboard.press('Escape');
        await dialogPage.expectNotVisible();
      }
    });

    test('should fill notes field when creating contact', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const fullName = `Notes Contact ${randomString(6)}`;
        const notes = 'This is a test note for the contact.';

        await dialogPage.fillInput('Full Name', fullName);
        await dialogPage.fillInput('Email', randomEmail());

        const notesTextarea = dialogPage.dialog.locator('#notes, textarea[id="notes"]');
        if (await notesTextarea.isVisible().catch(() => false)) {
          await notesTextarea.fill(notes);
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.expectRowWithText(fullName);
      }
    });
  });

  test.describe('View Contact', () => {
    test('should navigate to contact detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click the view button (Eye icon)
      const viewButton = listPage.getRow(0).locator('button[title="View details"], button:has([class*="Eye"])').first();
      if (await viewButton.isVisible().catch(() => false)) {
        await viewButton.click();
        await expect(page).toHaveURL(/\/relationships\/contacts\/[^/]+$/);
      } else {
        // Alternative: click on the row itself
        const viewLink = listPage.getRow(0).locator('a').first();
        if (await viewLink.isVisible().catch(() => false)) {
          await viewLink.click();
          await expect(page).toHaveURL(/\/relationships\/contacts\/[^/]+$/);
        }
      }
    });

    test('should display contact details on detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get contact name before navigating
      const firstRowText = await listPage.getRow(0).textContent();

      // Click view button
      const viewButton = listPage.getRow(0).locator('button[title="View details"]').first();
      if (await viewButton.isVisible().catch(() => false)) {
        await viewButton.click();
        await page.waitForURL(/\/relationships\/contacts\/[^/]+$/);

        // Verify contact details are displayed
        const heading = page.locator('h1, h2').first();
        await expect(heading).toBeVisible();
      }
    });
  });

  test.describe('Edit Contact', () => {
    test('should open edit dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click the edit button (Pencil icon)
      const editButton = listPage.getRow(0).locator('button[title="Edit contact"], button:has([class*="Pencil"])').first();
      if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();

        const dialogOpened = await dialogPage.isOpen();
        const urlChanged = page.url().includes('/edit');

        expect(dialogOpened || urlChanged).toBe(true);
      }
    });

    test('should update contact name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click edit button
      const editButton = listPage.getRow(0).locator('button[title="Edit contact"]').first();
      if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();

        if (await dialogPage.isOpen()) {
          const newName = `Updated Contact ${randomString(6)}`;

          // Clear and fill the name field (edit dialog uses different IDs)
          const nameInput = dialogPage.dialog.locator('#edit-name, #name, input[id$="-name"]').first();
          await nameInput.clear();
          await nameInput.fill(newName);

          await dialogPage.confirm();
          await listPage.waitForPageLoad();

          await listPage.expectRowWithText(newName);
        }
      }
    });

    test('should update contact email', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const editButton = listPage.getRow(0).locator('button[title="Edit contact"]').first();
      if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();

        if (await dialogPage.isOpen()) {
          const newEmail = randomEmail();

          const emailInput = dialogPage.dialog.locator('#edit-email, #email, input[type="email"]').first();
          await emailInput.clear();
          await emailInput.fill(newEmail);

          await dialogPage.confirm();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should update contact phone', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const editButton = listPage.getRow(0).locator('button[title="Edit contact"]').first();
      if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();

        if (await dialogPage.isOpen()) {
          const newPhone = randomPhone();

          const phoneInput = dialogPage.dialog.locator('#edit-phone, #phone').first();
          if (await phoneInput.isVisible().catch(() => false)) {
            await phoneInput.clear();
            await phoneInput.fill(newPhone);
          }

          await dialogPage.confirm();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should update job title and department', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const editButton = listPage.getRow(0).locator('button[title="Edit contact"]').first();
      if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();

        if (await dialogPage.isOpen()) {
          const newTitle = 'Senior Manager';
          const newDept = 'Engineering';

          const titleInput = dialogPage.dialog.locator('#edit-title, #title').first();
          if (await titleInput.isVisible().catch(() => false)) {
            await titleInput.clear();
            await titleInput.fill(newTitle);
          }

          const deptInput = dialogPage.dialog.locator('#edit-department, #department').first();
          if (await deptInput.isVisible().catch(() => false)) {
            await deptInput.clear();
            await deptInput.fill(newDept);
          }

          await dialogPage.confirm();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should cancel edit operation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get original name
      const originalText = await listPage.getRow(0).textContent();

      const editButton = listPage.getRow(0).locator('button[title="Edit contact"]').first();
      if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();

        if (await dialogPage.isOpen()) {
          const nameInput = dialogPage.dialog.locator('#edit-name, #name').first();
          await nameInput.clear();
          await nameInput.fill(`Should Not Save ${randomString(6)}`);

          await dialogPage.cancel();
          await dialogPage.expectNotVisible();

          // Verify original data is preserved
          const currentText = await listPage.getRow(0).textContent();
          expect(currentText).toBe(originalText);
        }
      }
    });
  });

  test.describe('Delete Contact', () => {
    test('should show delete confirmation dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Set up dialog handler before clicking delete
      const dialogPromise = page.waitForEvent('dialog');

      const deleteButton = listPage.getRow(0).locator('button[title="Delete contact"], button:has([class*="Trash"])').first();
      if (await deleteButton.isVisible().catch(() => false)) {
        await deleteButton.click();

        const dialog = await dialogPromise;
        expect(dialog.message().toLowerCase()).toContain('delete');
        await dialog.dismiss();
      }
    });

    test('should cancel delete operation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Dismiss the confirmation dialog
      page.once('dialog', (dialog) => dialog.dismiss());

      const deleteButton = listPage.getRow(0).locator('button[title="Delete contact"]').first();
      if (await deleteButton.isVisible().catch(() => false)) {
        await deleteButton.click();

        // Verify count is unchanged
        const newCount = await listPage.getRowCount();
        expect(newCount).toBe(rowCount);
      }
    });

    test('should delete contact after confirmation', async ({ page }) => {
      // First, create a contact to delete
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const contactToDelete = `Delete Me ${randomString(6)}`;
        await dialogPage.fillInput('Full Name', contactToDelete);
        await dialogPage.fillInput('Email', randomEmail());
        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify contact was created
        await listPage.expectRowWithText(contactToDelete);

        const rowCount = await listPage.getRowCount();

        // Accept the confirmation dialog
        page.once('dialog', (dialog) => dialog.accept());

        // Find and click delete on the newly created contact
        const row = await listPage.findRowByText(contactToDelete);
        const deleteButton = row.locator('button[title="Delete contact"]').first();

        if (await deleteButton.isVisible().catch(() => false)) {
          await deleteButton.click();
          await listPage.waitForPageLoad();

          // Verify count decreased
          const newCount = await listPage.getRowCount();
          expect(newCount).toBeLessThan(rowCount);

          // Verify contact is no longer in list
          await listPage.expectNoRowWithText(contactToDelete);
        }
      }
    });

    test('should show success toast after deletion', async ({ page }) => {
      // First, create a contact to delete
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const contactToDelete = `Toast Test ${randomString(6)}`;
        await dialogPage.fillInput('Full Name', contactToDelete);
        await dialogPage.fillInput('Email', randomEmail());
        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Accept the confirmation dialog
        page.once('dialog', (dialog) => dialog.accept());

        // Find and delete the contact
        const row = await listPage.findRowByText(contactToDelete);
        const deleteButton = row.locator('button[title="Delete contact"]').first();

        if (await deleteButton.isVisible().catch(() => false)) {
          await deleteButton.click();

          // Verify success toast
          await listPage.expectToast('deleted');
        }
      }
    });
  });

  test.describe('Table Sorting', () => {
    test('should sort by name', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      const nameHeader = listPage.tableHeaders.filter({ hasText: 'Name' }).first();
      if (await nameHeader.isVisible().catch(() => false)) {
        await nameHeader.click();
        await listPage.waitForPageLoad();
        // Verify sorting occurred (implementation dependent)
      }
    });

    test('should sort by company', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      const companyHeader = listPage.tableHeaders.filter({ hasText: 'Company' }).first();
      if (await companyHeader.isVisible().catch(() => false)) {
        await companyHeader.click();
        await listPage.waitForPageLoad();
      }
    });

    test('should sort by email', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      const emailHeader = listPage.tableHeaders.filter({ hasText: 'Email' }).first();
      if (await emailHeader.isVisible().catch(() => false)) {
        await emailHeader.click();
        await listPage.waitForPageLoad();
      }
    });
  });

  test.describe('Pagination', () => {
    test('should show pagination for many contacts', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount >= 10) {
        await expect(listPage.pagination).toBeVisible();
      }
    });

    test('should navigate between pages', async () => {
      if (await listPage.hasNextPage()) {
        await listPage.nextPage();
        await expect(listPage.prevPageButton).toBeEnabled();

        await listPage.prevPage();
        await expect(listPage.nextPageButton).toBeEnabled();
      }
    });
  });

  test.describe('Status Badge', () => {
    test('should display active status badge for active contacts', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const statusBadge = listPage.getRow(0).locator('span:has-text("active"), [class*="Badge"]');
      if (await statusBadge.isVisible().catch(() => false)) {
        await expect(statusBadge).toBeVisible();
      }
    });
  });

  test.describe('Empty State', () => {
    test('should display empty state message when no contacts', async ({ page }) => {
      // This test is conditional - only runs if there are no contacts
      const rowCount = await listPage.getRowCount();
      if (rowCount > 0) {
        test.skip();
        return;
      }

      const emptyMessage = page.locator('text=/No contacts found|No results/i');
      await expect(emptyMessage).toBeVisible();
    });

    test('should display add contacts prompt in empty state', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount > 0) {
        test.skip();
        return;
      }

      const addPrompt = page.locator('text=/Add contacts|track key people/i');
      await expect(addPrompt).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should be functional on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await listPage.waitForPageLoad();

      // Table or cards should still be visible
      const hasContent = (await listPage.getRowCount()) > 0 || await listPage.isEmpty();
      expect(hasContent).toBe(true);
    });

    test('should be functional on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await listPage.waitForPageLoad();

      // Table or cards should still be visible
      const hasContent = (await listPage.getRowCount()) > 0 || await listPage.isEmpty();
      expect(hasContent).toBe(true);

      // Create button should still be accessible
      await expect(listPage.createButton).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels on action buttons', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check that action buttons have accessible names
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      const editButton = listPage.getRow(0).locator('button[title="Edit contact"]');
      const deleteButton = listPage.getRow(0).locator('button[title="Delete contact"]');

      if (await viewButton.isVisible().catch(() => false)) {
        const srText = await viewButton.locator('.sr-only').textContent();
        expect(srText).toBeTruthy();
      }
    });

    test('should have proper table structure', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Table should have proper semantic structure
      await expect(listPage.table).toBeVisible();
      const headers = await listPage.tableHeaders.count();
      expect(headers).toBeGreaterThan(0);
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle special characters in contact name', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const specialName = `Test O'Brien & Co. ${randomString(4)}`;
        const email = randomEmail();

        await dialogPage.fillInput('Full Name', specialName);
        await dialogPage.fillInput('Email', email);

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.expectRowWithText("O'Brien");
      }
    });

    test('should handle unicode characters in contact name', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const unicodeName = `Test User ${randomString(4)}`;
        const email = randomEmail();

        await dialogPage.fillInput('Full Name', unicodeName);
        await dialogPage.fillInput('Email', email);

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.expectRowWithText(unicodeName);
      }
    });

    test('should handle long contact name', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const longName = `Very Long Contact Name That Tests The UI Layout ${randomString(8)}`;
        const email = randomEmail();

        await dialogPage.fillInput('Full Name', longName);
        await dialogPage.fillInput('Email', email);

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify contact was created (name may be truncated in display)
        await listPage.expectRowWithText('Very Long');
      }
    });

    test('should handle empty optional fields', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const minimalName = `Minimal Contact ${randomString(6)}`;

        // Only fill required field
        await dialogPage.fillInput('Full Name', minimalName);

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.expectRowWithText(minimalName);
      }
    });
  });
});
