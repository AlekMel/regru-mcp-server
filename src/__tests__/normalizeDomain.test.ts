import { describe, it, expect } from '@jest/globals';
import { normalizeDomain } from '../client/domain.js';

describe('normalizeDomain', () => {
  it('lowercases ASCII domains', () => {
    expect(normalizeDomain('Example.COM')).toBe('example.com');
  });

  it('converts Cyrillic IDN to punycode', () => {
    expect(normalizeDomain('тест.рф')).toBe('xn--e1aybc.xn--p1ai');
  });

  it('leaves already-punycode domains unchanged', () => {
    expect(normalizeDomain('xn--e1aybc.xn--p1ai')).toBe('xn--e1aybc.xn--p1ai');
  });

  it('trims whitespace', () => {
    expect(normalizeDomain('  example.ru  ')).toBe('example.ru');
  });
});
