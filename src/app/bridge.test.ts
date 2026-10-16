// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';

// Simulates the parts of index.html the bridge relies on, then loads the bridge exactly as main.js does.
beforeAll(async () => {
  document.body.innerHTML = '<header id="top"></header><div id="langtoggle"><button data-l="bn">বাংলা</button><button data-l="en">English</button></div>';
  localStorage.setItem('lang', 'bn');
  await import('../portal-bridge.js');
});
const sheet = () => document.getElementById('vl-sheet')!;

describe('portal bridge', () => {
  it('adds Verify a Plot and Sign in to the header in Bangla by default', () => {
    expect(document.querySelector('#top #vl-verify')?.textContent).toBe('প্লট যাচাই করুন');
    expect(document.querySelector('#vl-signbtn')?.textContent).toBe('লগইন');
    expect(document.querySelector('#vl-menu a[href="/portal/login"]')).toBeTruthy();
    expect(document.querySelector('#vl-menu a[href="/admin/login"]')).toBeTruthy();
  });
  it('area sheet links to /portal/verify with the exact glb key and can still open the satellite map', () => {
    let opened = 0;
    (window as any).__vlandAreaSheet({ key: 'Dhaka__Dhaka__Uttara', label: 'উত্তরা', crumbs: ['ঢাকা', 'ঢাকা', 'উত্তরা'], open: () => opened++ });
    expect(sheet().querySelector('h2')?.textContent).toBe('উত্তরা');
    expect(sheet().querySelector('#vl-go')?.getAttribute('href')).toBe('/portal/verify?area=Dhaka__Dhaka__Uttara');
    (sheet().querySelector('#vl-sat') as HTMLButtonElement).click();
    expect(opened).toBe(1);
    expect(sheet().classList.contains('open')).toBe(false);
  });
  it('switches language with the map toggle and escapes HTML in names', async () => {
    (window as any).__vlandAreaSheet({ key: 'X__Y__Z', label: '<img src=x onerror=alert(1)>', crumbs: ['X', 'Y', 'Z'], open: () => undefined });
    expect(sheet().innerHTML).not.toContain('<img');
    localStorage.setItem('lang', 'en');
    (document.querySelector('[data-l="en"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 10));
    expect(document.querySelector('#vl-verify')?.textContent).toBe('Verify a Plot');
    expect(sheet().querySelector('#vl-go span')?.textContent).toBe('Verify plots here');
  });
  it('Escape closes the sheet', async () => {
    (window as any).__vlandAreaSheet({ key: 'A__B__C', label: 'Test', crumbs: ['A', 'B', 'C'], open: () => undefined });
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(sheet().classList.contains('open')).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(sheet().classList.contains('open')).toBe(false);
  });
});
