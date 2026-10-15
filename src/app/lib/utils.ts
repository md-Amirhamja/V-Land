import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...i: ClassValue[]) => twMerge(clsx(i));

/** Only allow in-app redirects ("/portal/my"), never "//evil.com" or "https://...". */
export function safeRedirect(to: unknown, fallback: string): string {
  return typeof to === 'string' && to.startsWith('/') && !to.startsWith('//') && !to.includes('\\') ? to : fallback;
}
