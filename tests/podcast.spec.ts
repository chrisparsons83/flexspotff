import { test, expect } from '@playwright/test';

test('should navigate to the podcast page', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Podcast');
  await expect(page).toHaveURL('/podcast');
  await expect(page.locator('h2')).toContainText('Trash Turtle Football');
});
