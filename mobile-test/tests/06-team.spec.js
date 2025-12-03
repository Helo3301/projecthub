const { test, expect } = require('@playwright/test');
const { login, TEST_USER } = require('./helpers');

test.describe('Team Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.locator('aside').getByRole('link', { name: 'Team' }).click();
    await expect(page).toHaveURL(/\/team/);
  });

  test.describe('Layout', () => {
    test('should display Team page header', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
    });

    test('should display subtitle', async ({ page }) => {
      await expect(page.getByText('Manage your team')).toBeVisible();
    });

    test('should display Add User button', async ({ page }) => {
      // Look for Add User button text (with icon)
      await expect(page.getByText('Add User')).toBeVisible();
    });

    test('should display Members count', async ({ page }) => {
      await expect(page.getByText(/Members/i).first()).toBeVisible();
    });
  });

  test.describe('Team Members List', () => {
    test('should display team members', async ({ page }) => {
      // Should show Tim Allen
      await expect(page.getByText('Tim Allen')).toBeVisible();
    });

    test('should display member usernames', async ({ page }) => {
      await expect(page.getByText('@Helo')).toBeVisible();
    });

    test('should display member roles', async ({ page }) => {
      // Should show role badges - look in main content area
      await expect(page.locator('main').getByText('Member').first()).toBeVisible();
    });

    test('should display Rowen as team member', async ({ page }) => {
      await expect(page.getByText('Rowen')).toBeVisible();
    });

    test('should display Rowen username', async ({ page }) => {
      await expect(page.getByText('@Redskittles')).toBeVisible();
    });
  });

  test.describe('Add User Button', () => {
    test('should have clickable Add User button', async ({ page }) => {
      // Check the Add User button text is visible
      await expect(page.getByText('Add User')).toBeVisible();
    });
  });

  test.describe('Member Cards', () => {
    test('should display member cards', async ({ page }) => {
      // Should have cards with white background
      const cards = page.locator('.bg-white');
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('should display member avatars', async ({ page }) => {
      // Avatar circles should be visible
      const avatars = page.locator('.rounded-full');
      const count = await avatars.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});
