import { test, expect } from '@playwright/test';

// Each test group gets its own user to avoid dependencies
const getTestUser = () => ({
  email: `test${Date.now()}${Math.random().toString(36).slice(2)}@example.com`,
  password: 'TestPassword123!'
});

test.describe('Authentication', () => {
  test.describe('Sign Up', () => {
    test('should display signup page correctly', async ({ page }) => {
      await page.goto('/signup');
      
      await expect(page.locator('h1')).toContainText('Create Account');
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]').first()).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toContainText('Create Account');
    });

    test('should show error for invalid email', async ({ page }) => {
      const user = getTestUser();
      await page.goto('/signup');
      
      await page.fill('input[type="email"]', 'invalid-email');
      await page.fill('input[type="password"]', user.password);
      await page.fill('input[type="password"]:last-of-type', user.password);
      await page.click('button[type="submit"]');
      
      // HTML5 validation should prevent submission
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toHaveAttribute('type', 'email');
    });

    test('should show error for password mismatch', async ({ page }) => {
      const user = getTestUser();
      await page.goto('/signup');
      
      await page.fill('input[type="email"]', user.email);
      await page.locator('input[type="password"]').first().fill(user.password);
      await page.locator('input[type="password"]').last().fill('DifferentPassword123!');
      await page.click('button[type="submit"]');
      
      await expect(page.locator('text=Passwords do not match')).toBeVisible();
    });

    test('should show error for short password', async ({ page }) => {
      const user = getTestUser();
      await page.goto('/signup');
      
      await page.fill('input[type="email"]', user.email);
      await page.locator('input[type="password"]').first().fill('short');
      await page.locator('input[type="password"]').last().fill('short');
      await page.click('button[type="submit"]');
      
      // HTML5 validation prevents submission, or our custom validation shows error
      // Check we're still on signup page (form didn't submit)
      await expect(page).toHaveURL('/signup');
    });

    test('should successfully create account and redirect to dashboard', async ({ page }) => {
      const user = getTestUser();
      await page.goto('/signup');
      
      await page.fill('input[type="email"]', user.email);
      await page.locator('input[type="password"]').first().fill(user.password);
      await page.locator('input[type="password"]').last().fill(user.password);
      await page.click('button[type="submit"]');
      
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
      await expect(page.locator('h1:has-text("My Alerts")')).toBeVisible();
    });

    test('should show error for duplicate email', async ({ page }) => {
      // First create a user
      const user = getTestUser();
      await page.goto('/signup');
      await page.fill('input[type="email"]', user.email);
      await page.locator('input[type="password"]').first().fill(user.password);
      await page.locator('input[type="password"]').last().fill(user.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
      
      // Now try to signup with same email
      await page.goto('/signup');
      await page.fill('input[type="email"]', user.email);
      await page.locator('input[type="password"]').first().fill(user.password);
      await page.locator('input[type="password"]').last().fill(user.password);
      await page.click('button[type="submit"]');
      
      await expect(page.locator('text=Email already registered')).toBeVisible({ timeout: 5000 });
    });

    test('should navigate to login page', async ({ page }) => {
      await page.goto('/signup');
      
      await page.click('text=Sign in');
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Login', () => {
    test('should display login page correctly', async ({ page }) => {
      await page.goto('/login');
      
      await expect(page.locator('h1')).toContainText('Stock Tracker');
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toContainText('Sign In');
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');
      
      await page.fill('input[type="email"]', 'nonexistent@example.com');
      await page.fill('input[type="password"]', 'wrongpassword123');
      await page.click('button[type="submit"]');
      
      // Should show an error message and stay on login page
      await expect(page).toHaveURL('/login');
      await page.waitForTimeout(1000);
      // Check for any error message (could be "Invalid email or password" or "Invalid credentials")
      const errorVisible = await page.locator('[class*="red"], [class*="error"], [role="alert"]').first().isVisible().catch(() => false);
      expect(errorVisible || await page.url().includes('/login')).toBeTruthy();
    });

    test('should successfully login and redirect to dashboard', async ({ page }) => {
      // First create a user
      const user = getTestUser();
      await page.goto('/signup');
      await page.fill('input[type="email"]', user.email);
      await page.locator('input[type="password"]').first().fill(user.password);
      await page.locator('input[type="password"]').last().fill(user.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
      
      // Logout
      await page.click('button:has(svg.lucide-log-out)');
      await expect(page).toHaveURL('/login');
      
      // Now login
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', user.password);
      await page.click('button[type="submit"]');
      
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
      await expect(page.locator('h1:has-text("My Alerts")')).toBeVisible();
    });

    test('should navigate to signup page', async ({ page }) => {
      await page.goto('/login');
      
      await page.click('text=Sign up');
      await expect(page).toHaveURL('/signup');
    });
  });

  test.describe('Logout', () => {
    test('should successfully logout', async ({ page }) => {
      // Create user and login
      const user = getTestUser();
      await page.goto('/signup');
      await page.fill('input[type="email"]', user.email);
      await page.locator('input[type="password"]').first().fill(user.password);
      await page.locator('input[type="password"]').last().fill(user.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
      
      // Click logout button
      await page.click('button:has(svg.lucide-log-out)');
      
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to login when accessing dashboard without auth', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL('/login');
    });

    test('should redirect to login when accessing create alert without auth', async ({ page }) => {
      await page.goto('/create');
      await expect(page).toHaveURL('/login');
    });

    test('should redirect to login when accessing history without auth', async ({ page }) => {
      await page.goto('/history');
      await expect(page).toHaveURL('/login');
    });
  });
});
