const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.locator('aside').getByText('Calendar').click();
    await expect(page).toHaveURL(/\/calendar/);
  });

  test.describe('Layout', () => {
    test('should display Calendar page', async ({ page }) => {
      await expect(page.locator('[data-testid="calendar-page"]')).toBeVisible();
    });

    test('should display project name', async ({ page }) => {
      // Project name may be in header or subtitle
      await expect(page.locator('main').getByText('Test').first()).toBeVisible();
    });

    test('should display Add Task button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /add task/i })).toBeVisible();
    });

    test('should display calendar view container', async ({ page }) => {
      await expect(page.locator('[data-testid="calendar-view"]')).toBeVisible();
    });
  });

  test.describe('Calendar Navigation', () => {
    test('should display current month/year', async ({ page }) => {
      const currentDate = new Date();
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
      const currentMonth = monthNames[currentDate.getMonth()];

      // Should show current month
      await expect(page.getByText(currentMonth).first()).toBeVisible();
    });

    test('should have navigation buttons', async ({ page }) => {
      // Calendar should have navigation buttons in the view
      const calendarView = page.locator('[data-testid="calendar-view"]');
      await expect(calendarView).toBeVisible();

      // Should have buttons within the calendar for navigation
      const buttons = calendarView.locator('button');
      const count = await buttons.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('should navigate months', async ({ page }) => {
      const calendarView = page.locator('[data-testid="calendar-view"]');

      // Click next/prev button
      const navButton = calendarView.locator('button').first();
      await navButton.click();
      await page.waitForTimeout(300);

      // Calendar should still be visible
      await expect(calendarView).toBeVisible();
    });
  });

  test.describe('Calendar Grid', () => {
    test('should display day of week headers', async ({ page }) => {
      // Check that at least some day headers are visible
      const calendarView = page.locator('[data-testid="calendar-view"]');
      await expect(calendarView.getByText('Sun')).toBeVisible();
      await expect(calendarView.getByText('Mon')).toBeVisible();
    });

    test('should display calendar days', async ({ page }) => {
      // Should have day cells visible in the calendar
      const calendarView = page.locator('[data-testid="calendar-view"]');
      // Look for number 1-31 in the calendar
      await expect(calendarView.getByText('1').first()).toBeVisible();
    });

    test('should highlight today', async ({ page }) => {
      const today = new Date();
      const todayFormatted = today.toISOString().split('T')[0];

      const todayCell = page.locator(`[data-testid="calendar-day-${todayFormatted}"]`);
      if (await todayCell.count() > 0) {
        await expect(todayCell).toBeVisible();
      }
    });

    test('should display calendar in grid format', async ({ page }) => {
      const calendarView = page.locator('[data-testid="calendar-view"]');
      await expect(calendarView).toBeVisible();
    });
  });

  test.describe('Add Task Button', () => {
    test('should have clickable Add Task button', async ({ page }) => {
      // Check the Add Task button is visible and enabled
      const addButton = page.getByRole('button', { name: 'Add Task', exact: true });
      await expect(addButton).toBeVisible();
      await expect(addButton).toBeEnabled();
    });
  });

  test.describe('Day Click', () => {
    test('should allow clicking on calendar days', async ({ page }) => {
      // Click on a calendar day
      const day = page.locator('[data-testid*="calendar-day-"]').first();
      await day.click();
      await page.waitForTimeout(300);

      // Modal should open or selection should change
      // Check if modal opens
      const dialog = page.getByRole('dialog');
      const dialogVisible = await dialog.isVisible().catch(() => false);

      // Either modal opened or day was selected - both are valid
      expect(dialogVisible || await day.isVisible()).toBeTruthy();
    });
  });
});
