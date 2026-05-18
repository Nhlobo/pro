import { describe, it, expect } from 'vitest';
import {
  normName, nameKey, normEmail, normPhone, canonUrl, hostOf,
} from '@/utils/attorneyNormalize';

describe('normName', () => {
  it('lowercases, trims and collapses whitespace', () => {
    expect(normName('   John   Smith  ')).toBe('john smith');
  });
  it('strips diacritics', () => {
    expect(normName('Müller Préc')).toBe('muller prec');
  });
  it('removes apostrophes', () => {
    expect(normName("O'Brien")).toBe('obrien');
    expect(normName('O’Brien')).toBe('obrien');
  });
  it('drops honorifics', () => {
    expect(normName('Dr. John Smith')).toBe('john smith');
    expect(normName('Adv Jane Doe')).toBe('jane doe');
    expect(normName('Mrs. Mary Jones')).toBe('mary jones');
  });
  it('drops firm suffixes', () => {
    expect(normName('Smith & Associates Inc')).toBe('smith');
    expect(normName('Acme Attorneys (Pty) Ltd')).toBe('acme');
    expect(normName('Cohen Attorneys Incorporated')).toBe('cohen');
    expect(normName('Lex Legal Practitioners')).toBe('lex');
  });
  it('returns empty string for nullish input', () => {
    expect(normName(undefined)).toBe('');
    expect(normName('')).toBe('');
  });
});

describe('nameKey', () => {
  it('matches initials with full names', () => {
    expect(nameKey('J P Smith')).toBe('smith');
    expect(nameKey('John Peter Smith')).toBe('john peter smith');
  });
  it('matches across honorifics and punctuation', () => {
    expect(nameKey('Dr. John Smith')).toBe(nameKey('john smith'));
  });
  it('matches across firm-suffix variants', () => {
    expect(nameKey('Smith & Associates Inc')).toBe(nameKey('Smith Attorneys'));
  });
});

describe('normEmail', () => {
  it('lowercases and trims', () => {
    expect(normEmail('  John@Example.COM ')).toBe('john@example.com');
  });
  it('strips +tag suffixes', () => {
    expect(normEmail('john+spam@example.com')).toBe('john@example.com');
  });
  it('normalizes gmail dots and folds googlemail', () => {
    expect(normEmail('john.smith@gmail.com')).toBe('johnsmith@gmail.com');
    expect(normEmail('John.Smith+work@googlemail.com')).toBe('johnsmith@gmail.com');
  });
  it('keeps dots on non-gmail domains', () => {
    expect(normEmail('john.smith@outlook.com')).toBe('john.smith@outlook.com');
  });
  it('rejects invalid input', () => {
    expect(normEmail('')).toBe('');
    expect(normEmail('no-at-sign')).toBe('');
    expect(normEmail('@nolocal.com')).toBe('');
    expect(normEmail('a@nodot')).toBe('');
    expect(normEmail(undefined)).toBe('');
  });
});

describe('normPhone', () => {
  it('returns the last 9 digits for ZA numbers', () => {
    expect(normPhone('0821234567')).toBe('821234567');
    expect(normPhone('+27 82 123 4567')).toBe('821234567');
    expect(normPhone('0027821234567')).toBe('821234567');
    expect(normPhone('27821234567')).toBe('821234567');
  });
  it('ignores formatting characters (spaces, dashes, parens, dots)', () => {
    expect(normPhone('(082) 123-4567')).toBe('821234567');
    expect(normPhone('082.123.4567')).toBe('821234567');
    expect(normPhone('+27-(0)82 123 4567')).toBe('821234567');
  });
  it('all variants of the same number collapse to one key', () => {
    const variants = [
      '0821234567',
      '082 123 4567',
      '(082) 123-4567',
      '+27821234567',
      '+27 82 123 4567',
      '0027 82 123 4567',
    ];
    const keys = new Set(variants.map((v) => normPhone(v)));
    expect(keys.size).toBe(1);
  });
  it('returns empty for blanks/non-digits', () => {
    expect(normPhone('')).toBe('');
    expect(normPhone(undefined)).toBe('');
    expect(normPhone('abc')).toBe('');
  });
  it('keeps short 7-8 digit local numbers as-is', () => {
    expect(normPhone('1234567')).toBe('1234567');
  });
});

describe('canonUrl', () => {
  it('strips query, hash, trailing slash and lowercases', () => {
    expect(canonUrl('HTTPS://Example.com/Path/?q=1#frag'))
      .toBe('https://example.com/path');
  });
  it('handles blank input', () => {
    expect(canonUrl('')).toBe('');
    expect(canonUrl(undefined)).toBe('');
  });
});

describe('hostOf', () => {
  it('returns hostname without www', () => {
    expect(hostOf('https://www.Example.com/x')).toBe('example.com');
    expect(hostOf('https://sub.example.co.za/x')).toBe('sub.example.co.za');
  });
  it('returns empty for invalid URLs', () => {
    expect(hostOf('not a url')).toBe('');
    expect(hostOf(undefined)).toBe('');
  });
});
