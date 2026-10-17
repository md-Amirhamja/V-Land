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
  await expect(page).toHaveURL(/\/portal$/);
  await page.reload();
  await expect(page).toHaveURL(/\/portal$/);
});

test('admin login works and lands on the dashboard', async ({ page }) => {
  await login(page, '/admin/login', ADMIN);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('each portal rejects the other account', async ({ page }) => {
  await login(page, '/admin/login', CITIZEN);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
  await login(page, '/portal/login', ADMIN);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/portal\/login/);
});

test('area link from the 3D map shows the area name, in Bangla and English', async ({ page }) => {
  await login(page, '/portal/verify?area=Dhaka__Dhaka__Uttara', CITIZEN);
  await expect(page.getByTestId('area-name')).toHaveText(/উত্তরা|Uttara/);
});

test('geography selectors load division, district, upazila, and mouza', async ({ page }) => {
  await login(page, '/portal/verify?area=Dhaka__Dhaka__Uttara', CITIZEN);
  await expect(page.getByLabel('division').locator('option')).toHaveCount(9);
  await expect(page.getByLabel('district')).toContainText('ঢাকা');
  await expect(page.getByLabel('area')).toContainText('উত্তরা');
  await expect(page.getByLabel('mouza')).toContainText('শোনাইপুর');
});

test('random geography path loads a mouza', async ({ page }) => {
  await login(page, '/portal/verify', CITIZEN);
  await page.getByLabel('division').selectOption({ label: 'বরিশাল' });
  await page.getByLabel('district').selectOption({ label: 'বরগুনা' });
  await page.getByLabel('area').selectOption({ label: 'আমতলী' });
  await expect(page.getByLabel('mouza')).toBeEnabled();
  await expect(page.getByLabel('mouza')).toContainText('আমতলী মৌজা');
});

test('judge demo reveals five random scenarios', async ({ page }) => {
  await login(page, '/portal', CITIZEN);
  await page.getByRole('button', { name: /৫টি ডেমো দেখান|Show 5 demos/ }).click();
  const demos = page.locator('a[href^="/portal/check?scenario="]');
  await expect(demos).toHaveCount(5);
  await demos.first().click();
  await expect(page.locator('section').first().getByRole('button', { name: /SCN-/ })).toHaveCount(1, { timeout: 30000 });
});

test('selecting a mouza shows five random records', async ({ page }) => {
  await login(page, '/portal/verify?area=Dhaka__Dhaka__Uttara', CITIZEN);
  await page.getByLabel('mouza').selectOption({ label: 'শোনাইপুর (JL 100)' });
  const records = page.locator('section').filter({ hasText: /এই মৌজার ৫টি রেকর্ড|Five records in this mouza/ });
  await expect(records.getByRole('heading', { name: /এই মৌজার ৫টি রেকর্ড|Five records in this mouza/ })).toBeVisible();
  const demoRecords = page.getByTestId('record-preview-list').getByRole('button');
  await expect(demoRecords).toHaveCount(5, { timeout: 30000 });
  await demoRecords.first().click();
  await expect(page.getByText(/✔ নির্বাচিত|✔ Selected/)).toBeVisible();
});

test('language switching works after opening record verification', async ({ page }) => {
  await login(page, '/portal/verify?area=Dhaka__Dhaka__Uttara', CITIZEN);
  await page.getByRole('button', { name: 'EN' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Verify a plot');
  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('প্লট যাচাই');
});

test('citizen sees owned plot details in My Space', async ({ page }) => {
  await login(page, '/portal/my', CITIZEN);
  await page.getByRole('tab', { name: /ক্রয় যাত্রা|Purchases/ }).click();
  await expect(page.getByRole('heading', { name: /আমার কেনা\/মালিকানাধীন প্লট|My purchased\/owned plots/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /শোনাইপুর|Shonaipur/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /বিস্তারিত দেখুন|View details/ })).toHaveCount(3);
});

test('citizen sees owned plots on the home page', async ({ page }) => {
  await login(page, '/portal', CITIZEN);
  await expect(page.getByRole('heading', { name: /আমার কেনা\/মালিকানাধীন প্লট|My purchased\/owned plots/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /বিস্তারিত দেখুন|View details/ })).toHaveCount(3);
  await expect(page.getByRole('link', { name: /মানচিত্রে দেখুন|View on map/ })).toHaveCount(3);
});

test('logout requires confirmation', async ({ page }) => {
  await login(page, '/portal', CITIZEN);
  await page.getByRole('button', { name: /লগআউট|Sign out/ }).click();
  await expect(page.getByRole('dialog', { name: /লগআউট নিশ্চিত করুন|Confirm sign out/ })).toBeVisible();
  await page.getByRole('button', { name: /বাতিল|Cancel/ }).click();
  await expect(page).toHaveURL(/\/portal$/);
});

test('language switch changes the page and the shared lang key', async ({ page }) => {
  await login(page, '/portal', CITIZEN);
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
