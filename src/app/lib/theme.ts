import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export type Scope = 'portal' | 'admin';
const DEFAULT: Record<Scope, Theme> = { portal: 'light', admin: 'dark' };   // phone-in-sunlight vs. office screen

export function getTheme(scope: Scope): Theme {
  try { const v = localStorage.getItem(`vland.theme.${scope}`); if (v === 'light' || v === 'dark') return v; } catch { /* */ }
  return DEFAULT[scope];
}
export function useTheme(scope: Scope) {
  const [theme, set] = useState<Theme>(() => getTheme(scope));
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const setTheme = useCallback((t: Theme) => { try { localStorage.setItem(`vland.theme.${scope}`, t); } catch { /* */ } set(t); }, [scope]);
  return { theme, setTheme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') };
}

export function useLargeText() {
  const [on, set] = useState(() => { try { return localStorage.getItem('vland.large') === '1'; } catch { return false; } });
  useEffect(() => { document.documentElement.classList.toggle('large-text', on); }, [on]);
  return { on, toggle: () => { try { localStorage.setItem('vland.large', on ? '0' : '1'); } catch { /* */ } set(!on); } };
}
