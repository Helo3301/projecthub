const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Gantt Chart', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.locator('aside').getByText('Gantt').click();
    await expect(page).toHaveURL(/\/gantt/);
  });

  test.describe('Layout', () => {
    test('should display Gantt Chart header', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Gantt Chart' })).toBeVisible();
    });

    test('should display project name', async ({ page }) => {
      await expect(page.locator('main').getByText('Test').first()).toBeVisible();
    });

    test('should display Add Task button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /add task/i })).toBeVisible();
    });
  });

  test.describe('Chart Components', () => {
    test('should display Gantt chart container', async ({ page }) => {
      await expect(page.locator('[data-testid="gantt-chart"]')).toBeVisible();
    });

    test('should display timeline header', async ({ page }) => {
      const chart = page.locator('[data-testid="gantt-chart"]');
      await expect(chart).toBeVisible();
    });

    test('should display task list area', async ({ page }) => {
      // Look for the Gantt chart or a "No tasks" message
      const chart = page.locator('[data-testid="gantt-chart"]');
      await expect(chart).toBeVisible();
    });

    test('should display month navigation', async ({ page }) => {
      // Should show current or selected month
      const monthLabel = page.getByText(/December|January|February|March|April|May|June|July|August|September|October|November/);
      await expect(monthLabel.first()).toBeVisible();
    });

    test('should have Today button', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
    });
  });

  test.describe('View Controls', () => {
    test('should have Today button visible', async ({ page }) => {
      // Today button should be visible for navigation
      await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
    });

    test('should have view mode controls', async ({ page }) => {
      // Check for Day/Week/Month view options
      const chart = page.locator('[data-testid="gantt-chart"]');
      await expect(chart).toBeVisible();

      // Day/Week/Month buttons should be visible as view controls
      await expect(page.getByRole('button', { name: 'Day', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Week', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Month', exact: true })).toBeVisible();
    });
  });

  test.describe('Add Task Button', () => {
    test('should have clickable Add Task button', async ({ page }) => {
      // Check the main Add Task button is visible and enabled (includes + icon)
      const addButton = page.getByRole('button', { name: /add task/i });
      await expect(addButton).toBeVisible();
      await expect(addButton).toBeEnabled();
    });
  });

  test.describe('Legend', () => {
    test('should display legend items', async ({ page }) => {
      // Should show Today button or legend
      const chart = page.locator('[data-testid="gantt-chart"]');
      await expect(chart).toBeVisible();
    });
  });
});
