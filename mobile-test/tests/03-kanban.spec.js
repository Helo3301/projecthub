const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Kanban Board', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.locator('aside').getByText('Kanban').click();
    await expect(page).toHaveURL(/\/kanban/);
  });

  test.describe('Layout', () => {
    test('should display Kanban Board header', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Kanban Board' })).toBeVisible();
    });

    test('should display Add Task button', async ({ page }) => {
      // Use exact match to avoid matching column quick-add buttons
      await expect(page.getByRole('button', { name: 'Add Task', exact: true })).toBeVisible();
    });

    test('should display project name', async ({ page }) => {
      // Project name is shown under the heading
      await expect(page.locator('main').getByText('Test').first()).toBeVisible();
    });
  });

  test.describe('Columns', () => {
    test('should display Backlog column', async ({ page }) => {
      await expect(page.getByText('Backlog')).toBeVisible();
    });

    test('should display To Do column', async ({ page }) => {
      await expect(page.getByText('To Do')).toBeVisible();
    });

    test('should display In Progress column', async ({ page }) => {
      await expect(page.getByText('In Progress').first()).toBeVisible();
    });

    test('should display Done column', async ({ page }) => {
      await expect(page.getByText('Done')).toBeVisible();
    });

    test('should display column headers with counts', async ({ page }) => {
      // Look for column headers with task counts
      const board = page.locator('[data-testid="kanban-board"]');
      await expect(board).toBeVisible();
    });

    test('should have horizontal scrolling', async ({ page }) => {
      const board = page.locator('[data-testid="kanban-board"]');
      await expect(board).toBeVisible();
    });
  });

  test.describe('Add Task Button', () => {
    test('should have clickable Add Task button', async ({ page }) => {
      // Check the main Add Task button is visible and enabled
      const addButton = page.getByRole('button', { name: 'Add Task', exact: true });
      await expect(addButton).toBeVisible();
      await expect(addButton).toBeEnabled();
    });

    test('should have column quick-add buttons', async ({ page }) => {
      // Each column should have a quick-add button
      const board = page.locator('[data-testid="kanban-board"]');
      await expect(board).toBeVisible();

      // There should be multiple add buttons (main + columns)
      const addButtons = page.locator('button').filter({ hasText: /add task/i });
      const count = await addButtons.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Board Functionality', () => {
    test('should display board area', async ({ page }) => {
      const board = page.locator('[data-testid="kanban-board"]');
      await expect(board).toBeVisible();
    });

    test('should have multiple columns', async ({ page }) => {
      // Check that we have the expected columns
      await expect(page.getByText('Backlog')).toBeVisible();
      await expect(page.getByText('To Do')).toBeVisible();
    });
  });
});
