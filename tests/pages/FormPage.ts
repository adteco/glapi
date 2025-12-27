import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Generic Form Page Object for create/edit forms
 * Handles form fields, validation, and submission
 */
export class FormPage extends BasePage {
  readonly form: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly resetButton: Locator;
  readonly errorMessages: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    super(page);

    this.form = page.locator('form').first();
    this.submitButton = this.form.locator(
      'button[type="submit"], button:has-text("Save"), button:has-text("Create"), button:has-text("Submit")'
    );
    this.cancelButton = this.form.locator(
      'button:has-text("Cancel"), button:has-text("Back"), a:has-text("Cancel")'
    );
    this.resetButton = this.form.locator('button[type="reset"], button:has-text("Reset")');
    this.errorMessages = page.locator(
      '[data-testid="error-message"], .error-message, [role="alert"], .text-destructive'
    );
    this.successMessage = page.locator(
      '[data-testid="success-message"], .success-message, [role="status"]'
    );
  }

  /**
   * Fill text input by name, label, or placeholder
   */
  async fillInput(identifier: string, value: string): Promise<void> {
    const input = this.form
      .locator(`input[name="${identifier}"]`)
      .or(this.form.getByLabel(identifier))
      .or(this.form.getByPlaceholder(identifier))
      .first();
    await input.clear();
    await input.fill(value);
  }

  /**
   * Fill textarea by name, label, or placeholder
   */
  async fillTextarea(identifier: string, value: string): Promise<void> {
    const textarea = this.form
      .locator(`textarea[name="${identifier}"]`)
      .or(this.form.getByLabel(identifier))
      .or(this.form.getByPlaceholder(identifier))
      .first();
    await textarea.clear();
    await textarea.fill(value);
  }

  /**
   * Select option from dropdown (native or custom)
   */
  async selectOption(identifier: string, optionText: string): Promise<void> {
    // Try to find by label first
    let trigger = this.form.getByLabel(identifier).first();

    if (!(await trigger.isVisible().catch(() => false))) {
      // Try by name or data-testid
      trigger = this.form
        .locator(`[name="${identifier}"], [data-testid="${identifier}"]`)
        .first();
    }

    // Check if it's a native select or custom dropdown
    const tagName = await trigger.evaluate((el) => el.tagName.toLowerCase());

    if (tagName === 'select') {
      await trigger.selectOption({ label: optionText });
    } else {
      // Custom dropdown (shadcn Select, Radix, etc.)
      await trigger.click();
      await this.page
        .locator(`[role="option"]:has-text("${optionText}")`)
        .first()
        .click();
    }
  }

  /**
   * Check/uncheck checkbox
   */
  async setCheckbox(identifier: string, checked: boolean): Promise<void> {
    const checkbox = this.form
      .locator(`input[type="checkbox"][name="${identifier}"]`)
      .or(this.form.getByLabel(identifier))
      .first();

    const isChecked = await checkbox.isChecked();
    if (isChecked !== checked) {
      await checkbox.click();
    }
  }

  /**
   * Select radio button
   */
  async selectRadio(name: string, value: string): Promise<void> {
    const radio = this.form.locator(`input[type="radio"][name="${name}"][value="${value}"]`);
    await radio.check();
  }

  /**
   * Fill date picker
   */
  async fillDate(identifier: string, date: string): Promise<void> {
    const input = this.form
      .locator(`input[name="${identifier}"]`)
      .or(this.form.getByLabel(identifier))
      .first();

    // For native date inputs
    const type = await input.getAttribute('type');
    if (type === 'date') {
      await input.fill(date);
    } else {
      // For custom date pickers, click and select
      await input.click();
      // Handle various date picker implementations
      await this.page.keyboard.type(date);
      await this.page.keyboard.press('Enter');
    }
  }

  /**
   * Fill number input
   */
  async fillNumber(identifier: string, value: number): Promise<void> {
    const input = this.form
      .locator(`input[name="${identifier}"]`)
      .or(this.form.getByLabel(identifier))
      .first();
    await input.clear();
    await input.fill(value.toString());
  }

  /**
   * Submit the form
   */
  async submit(): Promise<void> {
    await this.submitButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Cancel and go back
   */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Reset form to initial values
   */
  async reset(): Promise<void> {
    if (await this.resetButton.isVisible()) {
      await this.resetButton.click();
    }
  }

  /**
   * Check if form has validation errors
   */
  async hasErrors(): Promise<boolean> {
    return (await this.errorMessages.count()) > 0;
  }

  /**
   * Get all error messages
   */
  async getErrorMessages(): Promise<string[]> {
    const messages = await this.errorMessages.allTextContents();
    return messages.filter((m) => m.trim().length > 0);
  }

  /**
   * Verify specific error message is shown
   */
  async expectError(message: string | RegExp): Promise<void> {
    await expect(this.errorMessages.filter({ hasText: message })).toBeVisible();
  }

  /**
   * Verify no errors are shown
   */
  async expectNoErrors(): Promise<void> {
    await expect(this.errorMessages).toHaveCount(0);
  }

  /**
   * Verify success message
   */
  async expectSuccess(message?: string | RegExp): Promise<void> {
    if (message) {
      await expect(this.successMessage.filter({ hasText: message })).toBeVisible();
    } else {
      await expect(this.successMessage).toBeVisible();
    }
  }

  /**
   * Get input value
   */
  async getInputValue(identifier: string): Promise<string> {
    const input = this.form
      .locator(`input[name="${identifier}"]`)
      .or(this.form.getByLabel(identifier))
      .first();
    return await input.inputValue();
  }

  /**
   * Verify input has specific value
   */
  async expectInputValue(identifier: string, value: string): Promise<void> {
    const input = this.form
      .locator(`input[name="${identifier}"]`)
      .or(this.form.getByLabel(identifier))
      .first();
    await expect(input).toHaveValue(value);
  }

  /**
   * Verify form field is required
   */
  async isFieldRequired(identifier: string): Promise<boolean> {
    const input = this.form
      .locator(`input[name="${identifier}"]`)
      .or(this.form.getByLabel(identifier))
      .first();

    const required = await input.getAttribute('required');
    const ariaRequired = await input.getAttribute('aria-required');

    return required !== null || ariaRequired === 'true';
  }

  /**
   * Fill form with object of field values
   */
  async fillForm(data: Record<string, string | number | boolean>): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'boolean') {
        await this.setCheckbox(key, value);
      } else if (typeof value === 'number') {
        await this.fillNumber(key, value);
      } else {
        await this.fillInput(key, value);
      }
    }
  }

  /**
   * Submit form and wait for navigation
   */
  async submitAndNavigate(): Promise<void> {
    const currentURL = this.page.url();
    await this.submit();
    // Wait for URL to change
    await this.page.waitForURL((url) => url.toString() !== currentURL, { timeout: 10000 });
  }

  /**
   * Submit form and expect success toast
   */
  async submitAndExpectSuccess(successMessage?: string | RegExp): Promise<void> {
    await this.submit();
    if (successMessage) {
      await this.expectToast(successMessage, 'success');
    }
  }
}
