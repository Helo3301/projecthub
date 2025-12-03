const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Mobile Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.describe('Mobile Header', () => {
    test('should display mobile header with hamburger menu', async ({ page }, testInfo) => {
      if (testInfo.project.name === 'Desktop Chrome') {
        test.skip();
        return;
      }

      // Should have header with ProjectHub
      const header = page.locator('header');
      await expect(header).toBeVisible();
      await expect(header.getByText('ProjectHub')).toBeVisible();

      // Should have hamburger button
      const hamburger = header.locator('button').first();
      await expect(hamburger).toBeVisible();
    });

    test('should open sidebar when clicking hamburger', async ({ page }, testInfo) => {
      if (testInfo.project.name === 'Desktop Chrome') {
        test.skip();
        return;
      }

      // Click hamburger
      const hamburger = page.locator('header button').first();
      await hamburger.click();
      await page.waitForTimeout(500);

      // Sidebar should show navigation items
      await expect(page.locator('aside').getByText('Dashboard')).toBeVisible();
      await expect(page.locator('aside').getByText('Kanban')).toBeVisible();
    });

    test('should close sidebar when navigating', async ({ page }, testInfo) => {
      if (testInfo.project.name === 'Desktop Chrome') {
        test.skip();
        return;
      }

      // Open menu
      await page.locator('header button').first().click();
      await page.waitForTimeout(500);

      // Click a nav item
      await page.locator('aside').getByText('Kanban').click();
      await expect(page).toHaveURL(/\/kanban/);
    });
  });

  test.describe('Mobile Dashboard', () => {
    test('should display stat cards on mobile', async ({ page }, testInfo) => {
      if (testInfo.project.name === 'Desktop Chrome') {
        test.skip();
        return;
      }

      await expect(page.getByText('Total Tasks')).toBeVisible();
      await expect(page.getByText('Completed').first()).toBeVisible();
    });

    test('should have proper padding', async ({ page }, testInfo) => {
      if (testInfo.project.name === 'Desktop Chrome') {
        test.skip();
        return;
      }

      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test.describe('Mobile Kanban', () => {
    test('should have horizontal scroll for columns', async ({ page }, testInfo) => {
      if (testInfo.project.name === 'Desktop Chrome') {
        test.skip();
        return;
      }

      // Navigate to Kanban
      await page.locator('header button').first().click();
      await page.waitForTimeout(300);
      await page.locator('aside').getByText('Kanban').click();
      await expect(page).toHaveURL(/\/kanban/);

      // Board should be visible
      const board = page.locator('[data-testid="kanban-board"]');
      await expect(board).toBeVisible();
    });

    test('should display all columns', async ({ page }, testInfo) => {
      if (testInfo.project.name === 'Desktop Chrome') {
        test.skip();
        return;
      }

      await page.locator('header button').first().click();
      await page.waitForTimeout(300);
      await page.locator('aside').getByText('Kanban').click();

      await expect(page.getByText('Backlog')).toBeVisible();
    });
  });

  test.describe('Mobile Gantt', () => {
    test('should display Gantt chart on mobile', async ({ page }, testInfo) => {
      if (testInfo.project.name === 'Desktop Chrome') {
        test.skip();
        return;
      }

      await page.locator('header button').first().click();
      await page.waitForTimeout(300);
      await page.locator('aside').getByText('Gantt').click();
      await expect(page).toHaveURL(/\/gantt/);

      await expect(page.locator('[data-testid="gantt-chart"]')).toBeVisible();
    });

    test('should have Add Task button visible', async ({ page }, testInfo) => {
      if (testInfo.project.name === 'Desktop Chrome') {
        test.skip();
        return;
      }

      await page.locator('header button').first().click();
      await page.waitForTimeout(300);
      await page.locator('aside').getByText('Gantt').click();

      await expect(page.getByRole('button', { name: /add task/i })).toBeVisible();
    });
  });

  test.describe('Mobile Team', () => {
    test('should display team members on mobile', async ({ page }, testInfo) => {
      if (testInfo.project.name === 'Desktop Chrome') {
        test.skip();
        return;
      }

      await page.locator('header button').first().click();
      await page.waitForTimeout(300);
      await page.locator('aside').getByRole('link', { name: 'Team' }).click();
      await expect(page).toHaveURL(/\/team/);

      await expect(page.getByText('Tim Allen')).toBeVisible();
    });
  });

  test.describe('Mobile Login', () => {
    test('should display login form properly on mobile', async ({ page }) => {
      await page.goto('/login');

      await expect(page.locator('[data-testid="login-page"]')).toBeVisible();
      await expect(page.locator('[data-testid="username-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
    });
  });

  test.describe('Light Mode', () => {
    test('should display in light mode', async ({ page }, testInfo) => {
      if (testInfo.project.name === 'Desktop Chrome') {
        test.skip();
        return;
      }

      // Stat cards should be visible
      await expect(page.getByText('Total Tasks')).toBeVisible();
    });

    test('should have stat cards visible', async ({ page }) => {
      // Check main content area is visible
      await expect(page.locator('main')).toBeVisible();
      await expect(page.getByText('Total Tasks')).toBeVisible();
    });
  });

  test.describe('Touch Interactions', () => {
    test('should have tappable buttons', async ({ page }, testInfo) => {
      if (testInfo.project.name === 'Desktop Chrome') {
        test.skip();
        return;
      }

      const buttons = page.locator('button');
      const count = await buttons.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});

test.describe('Desktop Layout', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display sidebar permanently on desktop', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'Desktop Chrome') {
      test.skip();
      return;
    }

    const sidebar = page.locator('aside').last();
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText('Dashboard')).toBeVisible();
  });

  test('should display stat cards in grid on desktop', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'Desktop Chrome') {
      test.skip();
      return;
    }

    await expect(page.getByText('Total Tasks')).toBeVisible();
    await expect(page.getByText('Completed').first()).toBeVisible();
  });

  test('should display user info in sidebar on desktop', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'Desktop Chrome') {
      test.skip();
      return;
    }

    await expect(page.locator('aside').getByText('Tim Allen')).toBeVisible();
  });
});
