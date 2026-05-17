import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Landing page', () => {
  test('renders hero and primary CTAs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /catch the clause/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /view live demo/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /upload a document/i }).first()).toBeVisible();
  });

  test('live-demo CTA navigates to /analyze', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /view live demo/i }).first().click();
    await expect(page).toHaveURL(/\/analyze$/);
    await expect(page.getByText(/adversarial debate/i)).toBeVisible();
  });

  test('upload CTA navigates to /upload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /upload a document/i }).first().click();
    await expect(page).toHaveURL(/\/upload$/);
    await expect(page.getByRole('heading', { name: /upload a document/i })).toBeVisible();
  });

  test('has no detectable WCAG AA violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test('skip-link is keyboard reachable', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: /skip to main content/i });
    await expect(skip).toBeFocused();
  });
});
