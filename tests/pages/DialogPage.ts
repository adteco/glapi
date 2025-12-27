import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Dialog/Modal Page Object for handling modals, dialogs, and confirmation prompts
 * Works with shadcn/Radix dialog components
 */
export class DialogPage extends BasePage {
  readonly dialog: Locator;
  readonly dialogTitle: Locator;
  readonly dialogDescription: Locator;
  readonly dialogContent: Locator;
  readonly closeButton: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;
  readonly overlay: Locator;

  constructor(page: Page) {
    super(page);

    // Dialog container
    this.dialog = page.locator(
      '[role="dialog"], [data-radix-dialog-content], [data-state="open"][data-radix-dialog-content]'
    );
    this.overlay = page.locator(
      '[data-radix-dialog-overlay], [role="dialog"] + [aria-hidden="true"]'
    );

    // Dialog parts
    this.dialogTitle = this.dialog.locator(
      '[data-radix-dialog-title], h2, [role="heading"]'
    ).first();
    this.dialogDescription = this.dialog.locator(
      '[data-radix-dialog-description], .dialog-description'
    );
    this.dialogContent = this.dialog.locator('.dialog-content, [data-radix-dialog-content] > div');

    // Buttons
    this.closeButton = this.dialog.locator(
      'button[aria-label*="close"], button[aria-label*="Close"], button:has([data-testid="close-icon"])'
    );
    this.confirmButton = this.dialog.locator(
      'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Save"), button:has-text("Create"), button:has-text("Delete"), button[data-testid="confirm-button"]'
    ).first();
    this.cancelButton = this.dialog.locator(
      'button:has-text("Cancel"), button:has-text("No"), button:has-text("Close"), button[data-testid="cancel-button"]'
    ).first();
  }

  /**
   * Wait for dialog to be visible
   */
  async waitForDialog(timeout = 10000): Promise<void> {
    await this.dialog.waitFor({ state: 'visible', timeout });
  }

  /**
   * Wait for dialog to close
   */
  async waitForDialogClose(timeout = 10000): Promise<void> {
    await this.dialog.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Check if dialog is open
   */
  async isOpen(): Promise<boolean> {
    return await this.dialog.isVisible();
  }

  /**
   * Get dialog title text
   */
  async getTitle(): Promise<string> {
    return (await this.dialogTitle.textContent()) || '';
  }

  /**
   * Get dialog description text
   */
  async getDescription(): Promise<string> {
    return (await this.dialogDescription.textContent()) || '';
  }

  /**
   * Close dialog via X button
   */
  async close(): Promise<void> {
    await this.closeButton.click();
    await this.waitForDialogClose();
  }

  /**
   * Close dialog via Escape key
   */
  async closeWithEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.waitForDialogClose();
  }

  /**
   * Click confirm/primary button
   */
  async confirm(): Promise<void> {
    await this.confirmButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Click cancel button
   */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.waitForDialogClose();
  }

  /**
   * Click overlay to close (if enabled)
   */
  async clickOutside(): Promise<void> {
    await this.overlay.click({ force: true, position: { x: 10, y: 10 } });
  }

  /**
   * Verify dialog title
   */
  async expectTitle(title: string | RegExp): Promise<void> {
    await expect(this.dialogTitle).toHaveText(title);
  }

  /**
   * Verify dialog is visible
   */
  async expectVisible(): Promise<void> {
    await expect(this.dialog).toBeVisible();
  }

  /**
   * Verify dialog is not visible
   */
  async expectNotVisible(): Promise<void> {
    await expect(this.dialog).not.toBeVisible();
  }

  /**
   * Fill input inside dialog
   */
  async fillInput(labelOrName: string, value: string): Promise<void> {
    const input = this.dialog
      .locator(`input[name="${labelOrName}"]`)
      .or(this.dialog.getByLabel(labelOrName))
      .or(this.dialog.getByPlaceholder(labelOrName))
      .first();
    await input.clear();
    await input.fill(value);
  }

  /**
   * Fill textarea inside dialog
   */
  async fillTextarea(labelOrName: string, value: string): Promise<void> {
    const textarea = this.dialog
      .locator(`textarea[name="${labelOrName}"]`)
      .or(this.dialog.getByLabel(labelOrName))
      .first();
    await textarea.clear();
    await textarea.fill(value);
  }

  /**
   * Select dropdown option inside dialog
   */
  async selectOption(labelOrName: string, optionText: string): Promise<void> {
    const trigger = this.dialog.getByLabel(labelOrName).first();

    // Check if it's a native select
    const tagName = await trigger.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === 'select') {
      await trigger.selectOption({ label: optionText });
    } else {
      // Custom dropdown
      await trigger.click();
      await this.page
        .locator(`[role="option"]:has-text("${optionText}")`)
        .first()
        .click();
    }
  }

  /**
   * Set checkbox inside dialog
   */
  async setCheckbox(labelOrName: string, checked: boolean): Promise<void> {
    const checkbox = this.dialog
      .locator(`input[type="checkbox"][name="${labelOrName}"]`)
      .or(this.dialog.getByLabel(labelOrName))
      .first();

    if ((await checkbox.isChecked()) !== checked) {
      await checkbox.click();
    }
  }

  /**
   * Click button inside dialog by text
   */
  async clickButton(text: string): Promise<void> {
    await this.dialog.getByRole('button', { name: text }).click();
  }

  /**
   * Fill form and submit in dialog
   */
  async fillAndSubmit(data: Record<string, string | number | boolean>): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'boolean') {
        await this.setCheckbox(key, value);
      } else {
        await this.fillInput(key, String(value));
      }
    }
    await this.confirm();
  }

  /**
   * Get all visible errors in dialog
   */
  async getErrors(): Promise<string[]> {
    const errors = this.dialog.locator(
      '.error-message, [role="alert"], .text-destructive'
    );
    return await errors.allTextContents();
  }

  /**
   * Verify error is shown in dialog
   */
  async expectError(message: string | RegExp): Promise<void> {
    await expect(
      this.dialog.locator('.error-message, [role="alert"], .text-destructive')
        .filter({ hasText: message })
    ).toBeVisible();
  }
}

/**
 * Alert Dialog specifically for confirmation prompts
 */
export class AlertDialogPage extends DialogPage {
  readonly alertDialog: Locator;

  constructor(page: Page) {
    super(page);
    this.alertDialog = page.locator('[role="alertdialog"]');
  }

  /**
   * Wait for alert dialog
   */
  async waitForAlertDialog(timeout = 10000): Promise<void> {
    await this.alertDialog.waitFor({ state: 'visible', timeout });
  }

  /**
   * Confirm destructive action (e.g., delete)
   */
  async confirmDestructive(): Promise<void> {
    const deleteButton = this.alertDialog.locator(
      'button:has-text("Delete"), button:has-text("Remove"), button.destructive'
    ).first();
    await deleteButton.click();
    await this.waitForPageLoad();
  }
}
