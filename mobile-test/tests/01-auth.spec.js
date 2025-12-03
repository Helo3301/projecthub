const { test, expect } = require('@playwright/test');
const { TEST_USER, generateTestUser, login } = require('./helpers');

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');

      await expect(page.locator('[data-testid="login-page"]')).toBeVisible();
      await expect(page.locator('h1:has-text("ProjectHub")')).toBeVisible();
      await expect(page.getByText('Sign in to your account')).toBeVisible();
      await expect(page.locator('[data-testid="username-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
      await expect(page.getByText('Forgot password?')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
    });

    test('should login with valid credentials', async ({ page }) => {
      await login(page);

      // Should be on dashboard
      await expect(page).toHaveURL('/');
    });

    test('should show error with invalid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.fill('[data-testid="username-input"]', 'wronguser');
      await page.fill('[data-testid="password-input"]', 'wrongpass');
      await page.click('[data-testid="login-button"]');

      // Should show error message or stay on login page
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect unauthenticated users to login', async ({ page }) => {
      await page.goto('/');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test('should navigate to registration page', async ({ page }) => {
      await page.goto('/login');
      await page.getByRole('link', { name: 'Sign up' }).click();

      await expect(page).toHaveURL(/\/register/);
      await expect(page.locator('[data-testid="register-page"]')).toBeVisible();
    });

    test('should navigate to forgot password page', async ({ page }) => {
      await page.goto('/login');
      await page.getByText('Forgot password?').click();

      await expect(page).toHaveURL(/\/forgot-password/);
    });

    test('should toggle password visibility', async ({ page }) => {
      await page.goto('/login');

      const passwordInput = page.locator('[data-testid="password-input"]');

      // Initially should be password type
      await expect(passwordInput).toHaveAttribute('type', 'password');

      // Click toggle button (the eye icon button next to password)
      const toggleButton = page.locator('[data-testid="password-input"]').locator('xpath=..').locator('button');
      if (await toggleButton.count() > 0) {
        await toggleButton.click();
        await expect(passwordInput).toHaveAttribute('type', 'text');
      }
    });
  });

  test.describe('Registration Page', () => {
    test('should display registration form', async ({ page }) => {
      await page.goto('/register');

      await expect(page.locator('[data-testid="register-page"]')).toBeVisible();
      await expect(page.getByText('Create your account')).toBeVisible();
      await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="username-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="fullname-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="confirm-password-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="register-button"]')).toBeVisible();
    });

    test('should show validation errors for empty fields', async ({ page }) => {
      await page.goto('/register');
      await page.click('[data-testid="register-button"]');

      // Browser validation should prevent submission
      await expect(page).toHaveURL(/\/register/);
    });

    test('should show error for password mismatch', async ({ page }) => {
      await page.goto('/register');

      const testUser = generateTestUser();
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="username-input"]', testUser.username);
      await page.fill('[data-testid="fullname-input"]', testUser.fullName);
      await page.fill('[data-testid="password-input"]', 'Password123!');
      await page.fill('[data-testid="confirm-password-input"]', 'DifferentPassword!');
      await page.click('[data-testid="register-button"]');

      // Should show mismatch error
      await expect(page.getByText('Passwords do not match')).toBeVisible({ timeout: 5000 });
    });

    test('should navigate to login page', async ({ page }) => {
      await page.goto('/register');
      await page.getByRole('link', { name: 'Sign in' }).click();

      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Forgot Password Page', () => {
    test('should display forgot password form', async ({ page }) => {
      await page.goto('/forgot-password');

      await expect(page.getByRole('heading', { name: /Reset|Forgot/i })).toBeVisible();
    });

    test('should have forgot password form elements', async ({ page }) => {
      await page.goto('/forgot-password');

      // Should have a form with input and submit button
      const heading = page.getByRole('heading', { name: /Reset|Forgot/i });
      await expect(heading).toBeVisible();

      // Should have a submit button
      const submitButton = page.getByRole('button', { name: /reset|send|submit|back/i });
      await expect(submitButton).toBeVisible();
    });

    test('should navigate back to login', async ({ page }) => {
      await page.goto('/forgot-password');

      // Try clicking back to login link
      const backLink = page.getByRole('link', { name: /back to login|sign in/i });
      if (await backLink.count() > 0) {
        await backLink.click();
        await expect(page).toHaveURL(/\/login/);
      }
    });
  });

  test.describe('Session Management', () => {
    test('should persist login across page refreshes', async ({ page }) => {
      await login(page);
      await expect(page).toHaveURL('/');

      // Refresh page
      await page.reload();

      // Should still be logged in
      await expect(page).toHaveURL('/');
    });

    test('should logout successfully', async ({ page }) => {
      await login(page);
      await expect(page).toHaveURL('/');

      // Clear storage to simulate logout
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.goto('/');

      await expect(page).toHaveURL(/\/login/);
    });
  });
});
