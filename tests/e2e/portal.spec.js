import { test, expect } from '@playwright/test';

// Needs VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local and the demo users from the README.
const CITIZEN = { email: 'citizen.demo@example.com', password: 'Citizen@2026' };
const ADMIN = { email: 'admin.demo@example.com', password: 'Admin@2026' };

async function login(page, path, who) {
  await page.goto(path);
  await page.getByLabel(/ইমেইল|Email/).fill(who.email);
  await page.getByLabel(/পাসওয়ার্ড|Password/).fill(who.password);
  await page.getByRole('button', { name: /লগইন করুন|Sign in/ }).click();
}

test('signed-out /admin redirects to /admin/login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('citizen login works and survives a refresh', async ({ page }) => {
  await login(page, '/portal/login', CITIZEN);
  await expect(page).toHaveURL(/\/portal\/my/);
  await page.reload();
  await expect(page).toHaveURL(/\/portal\/my/);
});

test('admin login works and lands on the dashboard', async ({ page }) => {
  await login(page, '/admin/login', ADMIN);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('each portal rejects the other account', async ({ page }) => {
  await login(page, '/admin/login', CITIZEN);
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveURL(/\/admin\/login/);
  await login(page, '/portal/login', ADMIN);
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveURL(/\/portal\/login/);
});

test('area link from the 3D map shows the area name, in Bangla and English', async ({ page }) => {
  await page.goto('/portal/verify?area=Dhaka__Dhaka__Uttara');
  await expect(page.getByTestId('area-name')).toHaveText(/উত্তরা|Uttara/);
});

test('language switch changes the page and the shared lang key', async ({ page }) => {
  await page.goto('/portal');
  await page.getByRole('button', { name: 'EN' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Check before you buy');
  expect(await page.evaluate(() => localStorage.getItem('lang'))).toBe('en');
});

test('no horizontal scroll at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  for (const p of ['/portal', '/portal/login', '/admin/login']) {
    await page.goto(p);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, p).toBeLessThanOrEqual(0);
  }
});
