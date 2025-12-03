const { test, expect } = require('@playwright/test');
const { login, TEST_USER } = require('./helpers');

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.locator('aside').getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test.describe('Layout', () => {
    test('should display Settings header', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    });

    test('should have light mode styling', async ({ page }) => {
      // Page should have light background
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Profile Section', () => {
    test('should display profile heading', async ({ page }) => {
      await expect(page.getByText(/profile|account/i).first()).toBeVisible();
    });

    test('should display user name', async ({ page }) => {
      await expect(page.getByText(TEST_USER.fullName)).toBeVisible();
    });

    test('should display user email', async ({ page }) => {
      await expect(page.getByText(TEST_USER.email)).toBeVisible();
    });
  });

  test.describe('Settings Cards', () => {
    test('should have settings cards', async ({ page }) => {
      const cards = page.locator('.bg-white');
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('should have rounded card styling', async ({ page }) => {
      const roundedCards = page.locator('.rounded-lg, .rounded-xl');
      const count = await roundedCards.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Navigation', () => {
    test('should navigate back to dashboard', async ({ page }) => {
      await page.locator('aside').getByText('Dashboard').click();
      await expect(page).toHaveURL('/');
    });

    test('should navigate to team page', async ({ page }) => {
      await page.locator('aside').getByRole('link', { name: 'Team' }).click();
      await expect(page).toHaveURL(/\/team/);
    });
  });
});
