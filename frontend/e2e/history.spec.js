import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: `historytest${Date.now()}@example.com`,
  password: 'TestPassword123!'
};

test.describe('Alert History', () => {
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
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
  });

  test('should navigate to history page', async ({ page }) => {
    await page.click('text=History');
    await expect(page).toHaveURL('/history');
  });

  test('should display history page correctly', async ({ page }) => {
    await page.goto('/history');
    
    await expect(page.locator('h1')).toContainText('Alert History');
    // Page should load without errors
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should show empty state when no triggered alerts', async ({ page }) => {
    await page.goto('/history');
    
    // New user should have no triggered alerts
    await expect(page.locator('text=No triggered alerts yet')).toBeVisible();
    await expect(page.locator('text=When your alerts trigger')).toBeVisible();
  });

  test('should navigate between dashboard and history', async ({ page }) => {
    // Go to history
    await page.click('text=History');
    await expect(page).toHaveURL('/history');
    
    // Go back to dashboard
    await page.click('text=My Alerts');
    await expect(page).toHaveURL('/dashboard');
    
    // Go to history again
    await page.click('text=History');
    await expect(page).toHaveURL('/history');
  });
});
