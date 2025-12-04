const { chromium } = require('@playwright/test');

const URL = process.env.URL || 'http://localhost:3030';
const PASSWORD = process.env.PASSWORD || 'Whatsup3301?';
const USERNAME = process.env.USERNAME || 'Helo';

async function takeScreenshots() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  // Login page screenshot first (before login)
  console.log('Taking Login screenshot...');
  await page.goto(`${URL}/login`);
  await page.waitForSelector('[data-testid="login-page"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '../docs/screenshots/login.png' });

  // Login
  console.log('Logging in...');
  await page.fill('[data-testid="username-input"]', USERNAME);
  await page.fill('[data-testid="password-input"]', PASSWORD);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('**/', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Dashboard
  console.log('Taking Dashboard screenshot...');
  await page.screenshot({ path: '../docs/screenshots/dashboard.png' });

  // Kanban Board
  console.log('Taking Kanban screenshot...');
  await page.locator('aside').getByText('Kanban').click();
  await page.waitForURL(/\/kanban/);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '../docs/screenshots/kanban.png' });

  // Task Modal with Color Picker
  console.log('Taking Task Modal screenshot...');
  await page.getByRole('button', { name: 'Add Task', exact: true }).click();
  await page.waitForTimeout(500);
  const dialog = page.getByRole('dialog');
  await dialog.locator('[data-testid="task-title-input"]').fill('Example Task with Custom Color');
  await dialog.locator('[data-testid="task-description-input"]').fill('This task demonstrates the color picker feature');
  // Scroll to show color picker
  await dialog.evaluate(el => el.scrollTop = 300);
  await page.waitForTimeout(300);
  // Select a color
  await page.locator('button[title="#3B82F6"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: '../docs/screenshots/task-modal.png' });

  // Close modal by clicking the X button
  await dialog.locator('button').first().click();
  await page.waitForTimeout(500);
  // Make sure dialog is gone
  await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);

  // Gantt Chart
  console.log('Taking Gantt screenshot...');
  await page.locator('aside').getByText('Gantt').click({ force: true });
  await page.waitForURL(/\/gantt/);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '../docs/screenshots/gantt.png' });

  // Calendar
  console.log('Taking Calendar screenshot...');
  await page.locator('aside').getByText('Calendar').click();
  await page.waitForURL(/\/calendar/);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '../docs/screenshots/calendar.png' });

  // Team page
  console.log('Taking Team screenshot...');
  await page.locator('aside').getByText('Team').click();
  await page.waitForURL(/\/team/);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '../docs/screenshots/team.png' });

  await browser.close();
  console.log('All screenshots saved to docs/screenshots/');
}

takeScreenshots().catch(console.error);
