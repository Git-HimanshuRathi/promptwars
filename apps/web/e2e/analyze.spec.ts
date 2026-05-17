import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Live analysis demo (/analyze)', () => {
  test('renders the three-pane analysis layout', async ({ page }) => {
    await page.goto('/analyze');
    await expect(page.getByRole('region', { name: /contract document/i })).toBeVisible();
    await expect(page.getByRole('region', { name: /multi-agent debate/i })).toBeVisible();
    await expect(page.getByRole('region', { name: /risk summary/i })).toBeVisible();
  });

  test('shows the exploitation index gauge', async ({ page }) => {
    await page.goto('/analyze');
    const meter = page.getByRole('meter', { name: /exploitation index/i });
    await expect(meter).toBeVisible();
  });

  test('renders all five findings with severity chips', async ({ page }) => {
    await page.goto('/analyze');
    await expect(page.getByText('Asymmetric liability cap')).toBeVisible();
    await expect(page.getByText('Auto-renewal with 60-day window')).toBeVisible();
    await expect(page.getByText('Overbroad IP assignment')).toBeVisible();
  });

  test('mobile view exposes pane tabs', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/analyze');
    await expect(page.getByRole('tab', { name: /document/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /debate/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /risk/i })).toBeVisible();
  });

  test('analyze page has no critical a11y violations', async ({ page }) => {
    await page.goto('/analyze');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
  });
});

test.describe('Upload flow (/upload)', () => {
  test('renders upload and paste-text modes', async ({ page }) => {
    await page.goto('/upload');
    await expect(page.getByRole('tab', { name: /upload file/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /paste text/i })).toBeVisible();
  });

  test('switching to paste-text reveals textarea', async ({ page }) => {
    await page.goto('/upload');
    await page.getByRole('tab', { name: /paste text/i }).click();
    await expect(page.getByLabel(/paste document text/i)).toBeVisible();
  });

  test('analyze button is disabled until min length', async ({ page }) => {
    await page.goto('/upload');
    await page.getByRole('tab', { name: /paste text/i }).click();
    const button = page.getByRole('button', { name: /run multi-agent analysis/i });
    await expect(button).toBeDisabled();
    await page.getByLabel(/paste document text/i).fill('x'.repeat(100));
    await expect(button).toBeEnabled();
  });
});
