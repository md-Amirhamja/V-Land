import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(__dirname, '../locales');
const read = (lang: string, f: string) => JSON.parse(fs.readFileSync(path.join(dir, lang, f), 'utf8')) as Record<string, string>;
const files = fs.readdirSync(path.join(dir, 'en')).filter((f) => f.endsWith('.json'));

describe('translations', () => {
  it('has the same feature files in both languages', () => {
    expect(fs.readdirSync(path.join(dir, 'bn')).sort()).toEqual(fs.readdirSync(path.join(dir, 'en')).sort());
  });
  for (const f of files) {
    it(`${f}: every key exists in both languages and none is empty`, () => {
      const bn = read('bn', f), en = read('en', f);
      expect(Object.keys(bn).sort()).toEqual(Object.keys(en).sort());
      for (const [k, v] of Object.entries({ ...bn, ...en })) expect(v.trim(), k).not.toBe('');
    });
  }
  it('Bangla files actually contain Bangla script', () => {
    const bn = read('bn', 'portal.json');
    expect(/[\u0980-\u09FF]/.test(bn['portal.heroTitle'])).toBe(true);
  });
});
