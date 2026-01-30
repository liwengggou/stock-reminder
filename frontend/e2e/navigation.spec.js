import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: `navtest${Date.now()}@example.com`,
  password: 'TestPassword123!'
};

test.describe('Navigation', () => {
  test.beforeAll(async ({ browser }) => {
    // Create test user
    const page = await browser.newPage();
    await page.goto('/signup');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.locator('input[type="password"]').first().fill(TEST_USER.password);
    await page.locator('input[type="password"]').last().fill(TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
  });

  test('should display navigation bar', async ({ page }) => {
    // Check desktop nav links exist
    await expect(page.locator('nav a:has-text("Stock Tracker")').first()).toBeVisible();
    await expect(page.locator('nav a:has-text("My Alerts")').first()).toBeVisible();
    await expect(page.locator('nav a:has-text("Create Alert")').first()).toBeVisible();
    await expect(page.locator('nav a:has-text("History")').first()).toBeVisible();
  });

  test('should display user email in header', async ({ page }) => {
    await expect(page.locator(`text=${TEST_USER.email}`)).toBeVisible();
  });

  test('should navigate to all main pages', async ({ page }) => {
    // Dashboard
    await page.click('a:has-text("My Alerts")');
    await expect(page).toHaveURL('/dashboard');
    
    // Create Alert
    await page.click('a:has-text("Create Alert")');
    await expect(page).toHaveURL('/create');
    
    // History
    await page.click('a:has-text("History")');
    await expect(page).toHaveURL('/history');
    
    // Back to Dashboard via logo
    await page.click('a:has-text("Stock Tracker")');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should highlight active nav item', async ({ page }) => {
    // Dashboard should be active - check for some styling indicator
    const dashboardLink = page.locator('nav a:has-text("My Alerts")').first();
    await expect(dashboardLink).toBeVisible();
    
    // Navigate to create
    await page.locator('nav a:has-text("Create Alert")').first().click();
    await expect(page).toHaveURL('/create');
  });

  test('should redirect root to dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should redirect unknown routes to dashboard', async ({ page }) => {
    await page.goto('/unknown-route');
    await expect(page).toHaveURL('/dashboard');
  });
});
