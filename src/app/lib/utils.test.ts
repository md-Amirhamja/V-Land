import { describe, it, expect } from 'vitest';
import { safeRedirect } from './utils';

describe('safeRedirect', () => {
  it('keeps in-app paths', () => expect(safeRedirect('/portal/my?x=1', '/portal')).toBe('/portal/my?x=1'));
  it.each(['//evil.com', 'https://evil.com', 'javascript:alert(1)', '/\\evil.com', undefined, 42])('rejects %s', (v) => expect(safeRedirect(v, '/portal')).toBe('/portal'));
});
