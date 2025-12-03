/**
 * Test helpers for ProjectHub E2E tests
 */

const TEST_USER = {
  username: process.env.USERNAME || 'Helo',
  password: process.env.PASSWORD || 'Whatsup3301?',
  email: 'timallen3301@gmail.com',
  fullName: 'Tim Allen',
};

// Generate unique test data
const generateTestUser = () => ({
  username: `testuser_${Date.now()}`,
  email: `test_${Date.now()}@example.com`,
  password: 'TestPass123!',
  fullName: 'Test User',
});

/**
 * Login helper function
 */
async function login(page, username = TEST_USER.username, password = TEST_USER.password) {
  await page.goto('/login');
  await page.waitForSelector('[data-testid="login-page"]');

  await page.fill('[data-testid="username-input"]', username);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');

  // Wait for redirect to dashboard
  await page.waitForURL('**/', { timeout: 10000 });
}

/**
 * Logout helper function
 */
async function logout(page) {
  // Click logout button in sidebar (desktop) or menu
  const logoutButton = page.locator('button:has-text("Logout"), [data-testid="logout-button"]');
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    await page.waitForURL('**/login');
  }
}

/**
 * Check if user is logged in
 */
async function isLoggedIn(page) {
  try {
    await page.waitForURL('**/', { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Open mobile menu
 */
async function openMobileMenu(page) {
  const hamburger = page.locator('button:has(svg), [data-testid="hamburger-menu"]').first();
  if (await hamburger.isVisible()) {
    await hamburger.click();
    await page.waitForTimeout(300); // Wait for animation
  }
}

/**
 * Navigate via sidebar
 */
async function navigateTo(page, path, isMobile = false) {
  if (isMobile) {
    await openMobileMenu(page);
  }

  const links = {
    dashboard: 'Dashboard',
    kanban: 'Kanban',
    gantt: 'Gantt',
    calendar: 'Calendar',
    team: 'Team',
    settings: 'Settings',
  };

  const linkText = links[path];
  if (linkText) {
    await page.click(`text=${linkText}`);
    await page.waitForLoadState('networkidle');
  }
}

module.exports = {
  TEST_USER,
  generateTestUser,
  login,
  logout,
  isLoggedIn,
  openMobileMenu,
  navigateTo,
};
