import { test, expect } from '@playwright/test';

// Regression guard for the legacy 3D map (docs/LEGACY_MAP_CHECKLIST.md, automated part).
test('3D map still loads and the new bridge buttons exist', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|tile|openstreetmap|esri|google|fonts/i.test(m.text())) errors.push(m.text()); });
  await page.goto('/');
  await expect(page.locator('#c')).toBeVisible();
  for (const id of ['#top', '#tools', '#mapview', '#loading', '#tip', '#msg']) await expect(page.locator(id)).toHaveCount(1);   // legacy DOM ids must not change
  await expect(page.locator('#loading.hide')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('#vl-verify')).toBeVisible();
  await expect(page.locator('#vl-signbtn')).toBeVisible();
  await expect(page.locator('#crumbs')).toContainText(/বাংলাদেশ|Bangladesh/);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Sign in menu offers Citizen and Admin', async ({ page }) => {
  await page.goto('/');
  await page.locator('#vl-signbtn').click();
  await expect(page.locator('#vl-menu a[href="/portal/login"]')).toBeVisible();
  await expect(page.locator('#vl-menu a[href="/admin/login"]')).toBeVisible();
});

test('Verify a Plot opens the citizen portal', async ({ page }) => {
  await page.goto('/');
  await page.locator('#vl-verify').click();
  await expect(page).toHaveURL(/\/portal$/);
});
