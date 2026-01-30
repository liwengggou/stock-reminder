import { test, expect } from '@playwright/test';

// Helper to create a new user and login
const signupAndLogin = async (page) => {
  const user = {
    email: `alert${Date.now()}${Math.random().toString(36).slice(2)}@example.com`,
    password: 'TestPassword123!'
  };
  await page.goto('/signup');
  await page.fill('input[type="email"]', user.email);
  await page.locator('input[type="password"]').first().fill(user.password);
  await page.locator('input[type="password"]').last().fill(user.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
  return user;
};

// Helper to create an alert with better error handling
const createAlert = async (page, symbol, type, price) => {
  await page.click('a:has-text("Create Alert")');
  await expect(page).toHaveURL('/create');
  
  // Search for stock
  const searchInput = page.locator('input[placeholder*="Search"]');
  await searchInput.fill(symbol);
  await page.waitForTimeout(500); // Wait for search results
  
  // Click on the stock result
  await page.locator(`button:has-text("${symbol}")`).first().click();
  await page.waitForTimeout(500); // Wait for stock to be selected
  
  // Select alert type
  await page.click(`text=${type} Price`);
  
  // Set target price
  await page.locator('input[type="number"]').fill(price);
  
  // Submit
  await page.click('button:has-text("Create Alert")');
  await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
};

test.describe('Alert Management', () => {

  test.describe('Create Alert', () => {
    test('should create a "below price" alert', async ({ page }) => {
      await signupAndLogin(page);
      await createAlert(page, 'AAPL', 'Below', '100');
      
      // Alert should be visible on dashboard
      await expect(page.locator('text=AAPL').first()).toBeVisible();
    });

    test('should create an "above price" alert', async ({ page }) => {
      await signupAndLogin(page);
      await createAlert(page, 'MSFT', 'Above', '500');
      
      // Alert should be visible on dashboard
      await expect(page.locator('text=MSFT').first()).toBeVisible();
    });

    test('should navigate back to dashboard without creating', async ({ page }) => {
      await signupAndLogin(page);
      
      await page.click('a:has-text("Create Alert")');
      await expect(page).toHaveURL('/create');
      
      await page.click('text=Back to Dashboard');
      await expect(page).toHaveURL('/dashboard');
    });
  });

  test.describe('View Alerts', () => {
    test('should display alerts on dashboard', async ({ page }) => {
      await signupAndLogin(page);
      await createAlert(page, 'AAPL', 'Below', '100');
      
      await expect(page.locator('h1:has-text("My Alerts")')).toBeVisible();
      await expect(page.locator('text=AAPL').first()).toBeVisible();
    });

    test('should show current price for alerts', async ({ page }) => {
      await signupAndLogin(page);
      await createAlert(page, 'AAPL', 'Below', '100');
      
      // Wait for prices to load
      await page.waitForTimeout(2000);
      
      // Should show price data
      await expect(page.locator('text=Current').first()).toBeVisible();
    });

    test('should refresh alerts', async ({ page }) => {
      await signupAndLogin(page);
      await createAlert(page, 'AAPL', 'Below', '100');
      
      await page.click('button:has-text("Refresh")');
      
      // Dashboard should still be visible
      await expect(page.locator('h1:has-text("My Alerts")')).toBeVisible();
    });
  });

  test.describe('Alert Display', () => {
    test('should display alert with target price', async ({ page }) => {
      await signupAndLogin(page);
      await createAlert(page, 'AAPL', 'Below', '100');
      
      // Wait for alert card to load and verify content
      await expect(page.locator('text=AAPL').first()).toBeVisible();
      await expect(page.locator('text=$100.00').first()).toBeVisible();
      await expect(page.locator('text=BELOW')).toBeVisible();
    });

    test('should display current price for alert', async ({ page }) => {
      await signupAndLogin(page);
      await createAlert(page, 'AAPL', 'Below', '100');
      
      // Wait for alert card to load
      await expect(page.locator('text=AAPL').first()).toBeVisible();
      
      // Verify current price is displayed
      await expect(page.locator('text=Current').first()).toBeVisible();
    });
  });

  test.describe('Delete Alert', () => {
    test('should delete an alert', async ({ page }) => {
      await signupAndLogin(page);
      await createAlert(page, 'AAPL', 'Below', '100');
      
      // Wait for alert card to load
      await expect(page.locator('text=AAPL').first()).toBeVisible();
      
      // Accept dialog when it appears
      page.on('dialog', dialog => dialog.accept());
      
      // Find all small icon buttons in the card and click the last one (delete)
      const deleteButton = page.locator('main button').filter({ has: page.locator('svg') }).last();
      await deleteButton.click();
      
      // Wait for deletion and empty state
      await expect(page.locator('text=No alerts yet')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Empty State', () => {
    test('should show empty state when no alerts', async ({ browser }) => {
      // Create a new user with no alerts
      const page = await browser.newPage();
      const newUser = {
        email: `empty${Date.now()}@example.com`,
        password: 'TestPassword123!'
      };
      
      await page.goto('/signup');
      await page.fill('input[type="email"]', newUser.email);
      await page.locator('input[type="password"]').first().fill(newUser.password);
      await page.locator('input[type="password"]').last().fill(newUser.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
      
      // Should show empty state
      await expect(page.locator('text=No alerts yet')).toBeVisible();
      await expect(page.locator('text=Create your first price alert')).toBeVisible();
      
      await page.close();
    });
  });
});
