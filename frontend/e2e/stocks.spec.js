import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: `stocktest${Date.now()}@example.com`,
  password: 'TestPassword123!'
};

test.describe('Stock Search', () => {
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
    
    // Navigate to create alert page
    await page.click('text=Create Alert');
    await expect(page).toHaveURL('/create');
  });

  test('should display create alert page correctly', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Create Price Alert');
    await expect(page.locator('text=Select Stock')).toBeVisible();
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test('should search stocks by symbol', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('AAPL');
    
    // Wait for search results
    await expect(page.locator('button:has-text("AAPL")')).toBeVisible({ timeout: 10000 });
  });

  test('should search stocks by company name', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('Microsoft');
    
    // Wait for search results
    await expect(page.locator('button:has-text("MSFT")')).toBeVisible({ timeout: 10000 });
  });

  test('should select a stock and show current price', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('AAPL');
    
    // Wait for and click search result
    await page.locator('button:has-text("AAPL")').first().click();
    
    // Verify stock is selected and price is shown
    await expect(page.locator('text=AAPL').first()).toBeVisible();
    await expect(page.locator('text=$')).toBeVisible();
  });

  test('should allow changing selected stock', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('AAPL');
    await page.locator('button:has-text("AAPL")').first().click();
    
    // Click change button
    await page.click('text=Change');
    
    // Search input should be visible again
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test('should show alert type options after selecting stock', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('TSLA');
    await page.locator('button:has-text("TSLA")').first().click();
    
    // Verify alert type options are visible
    await expect(page.locator('text=Below Price')).toBeVisible();
    await expect(page.locator('text=Above Price')).toBeVisible();
    await expect(page.locator('text=Target Price (USD)')).toBeVisible();
  });
});
