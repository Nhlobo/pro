import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  normName, nameKey, normEmail, normPhone, canonUrl, hostOf,
} from '@/utils/attorneyNormalize';

// ---------- Arbitraries -----------------------------------------------------

const HONORIFICS = ['', 'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Adv', 'Hon', 'Sir'];
const SUFFIXES = ['', 'Inc', 'Incorporated', 'LLP', 'Ltd', 'Pty Ltd',
  'Attorneys', 'Associates', 'Law Firm', 'Legal Practitioners', '& Associates'];

const nameTokenArb = fc.stringMatching(/^[A-Z][a-z]{2,8}$/);
const personNameArb = fc.tuple(nameTokenArb, nameTokenArb).map(([a, b]) => `${a} ${b}`);

const honorificArb = fc.constantFrom(...HONORIFICS);
const suffixArb = fc.constantFrom(...SUFFIXES);
const whitespaceArb = fc.constantFrom(' ', '  ', '   ', '\t', ' \t ');

/** A randomly decorated version of a base name (honorific, punctuation, suffix, casing, ws). */
const decoratedNameArb = (base: string) =>
  fc.tuple(honorificArb, whitespaceArb, suffixArb, fc.boolean(), fc.boolean(), whitespaceArb).map(
    ([hon, ws1, suf, dotAfterHon, upper, ws2]) => {
      const h = hon ? `${hon}${dotAfterHon ? '.' : ''}${ws1}` : '';
      const s = suf ? `${ws2}${suf}` : '';
      const core = upper ? base.toUpperCase() : base;
      return `${h}${core}${s}`.replace(/\s+/g, (m) => m); // keep variation
    },
  );

// Email
const emailLocalArb = fc.stringMatching(/^[a-z][a-z0-9]{1,10}$/);
const gmailDomainArb = fc.constantFrom('gmail.com', 'googlemail.com', 'GMAIL.com', 'GoogleMail.COM');
const tagArb = fc.option(fc.stringMatching(/^[a-z]{1,6}$/), { nil: '' });

/** Random variation of a base gmail email (dots, +tag, googlemail, casing). */
const gmailVariantArb = (local: string) =>
  fc.tuple(
    fc.array(fc.boolean(), { minLength: local.length - 1, maxLength: local.length - 1 }),
    tagArb,
    gmailDomainArb,
    fc.boolean(),
  ).map(([dotMask, tag, domain, upper]) => {
    // Insert dots between characters where mask is true
    let withDots = local[0];
    for (let i = 1; i < local.length; i++) {
      withDots += (dotMask[i - 1] ? '.' : '') + local[i];
    }
    const withTag = tag ? `${withDots}+${tag}` : withDots;
    const finalLocal = upper ? withTag.toUpperCase() : withTag;
    return `${finalLocal}@${domain}`;
  });

// Phone: SA national subscriber digits
const subscriberArb = fc.stringMatching(/^[1-9]\d{8}$/); // 9 digits, no leading zero
const prefixArb = fc.constantFrom('0', '+27', '0027', '27', '+27 (0)', '+27-0');
const sepArb = fc.constantFrom('', ' ', '-', '.', '  ');

const phoneVariantArb = (sub: string) =>
  fc.tuple(prefixArb, sepArb, sepArb, sepArb, fc.boolean()).map(
    ([prefix, s1, s2, s3, parens]) => {
      // Split subscriber into 2/3/4 like 82 123 4567
      const a = sub.slice(0, 2);
      const b = sub.slice(2, 5);
      const c = sub.slice(5);
      const core = parens ? `(${a})${s1}${b}${s2}${c}` : `${a}${s1}${b}${s2}${c}`;
      return `${prefix}${s3}${core}`;
    },
  );

// ---------- Properties ------------------------------------------------------

describe('property: normName', () => {
  it('is idempotent', () => {
    fc.assert(fc.property(personNameArb, (n) => {
      expect(normName(normName(n))).toBe(normName(n));
    }));
  });

  it('is case-insensitive', () => {
    fc.assert(fc.property(personNameArb, (n) => {
      expect(normName(n)).toBe(normName(n.toUpperCase()));
      expect(normName(n)).toBe(normName(n.toLowerCase()));
    }));
  });

  it('collapses arbitrary whitespace', () => {
    fc.assert(fc.property(personNameArb, whitespaceArb, (n, ws) => {
      const [a, b] = n.split(' ');
      expect(normName(`${a}${ws}${b}`)).toBe(normName(n));
    }));
  });
});

describe('property: nameKey deduplication', () => {
  it('produces the same key across honorifics/suffixes/casing/whitespace', () => {
    fc.assert(fc.property(personNameArb, (base) => {
      return fc.assert(fc.property(decoratedNameArb(base), decoratedNameArb(base), (v1, v2) => {
        expect(nameKey(v1)).toBe(nameKey(v2));
      }), { numRuns: 20 });
    }), { numRuns: 25 });
  });

  it('returns non-empty key for any 2+ token name', () => {
    fc.assert(fc.property(personNameArb, (n) => {
      expect(nameKey(n).length).toBeGreaterThan(0);
    }));
  });
});

describe('property: normEmail', () => {
  it('is idempotent', () => {
    fc.assert(fc.property(emailLocalArb, gmailVariantArb('johnsmith'), (_l, e) => {
      expect(normEmail(normEmail(e))).toBe(normEmail(e));
    }));
  });

  it('all gmail variants of the same local part collapse to one address', () => {
    fc.assert(fc.property(
      fc.stringMatching(/^[a-z]{3,10}$/),
      (local) => {
        const samples = fc.sample(gmailVariantArb(local), 15);
        const keys = new Set(samples.map((s) => normEmail(s)));
        expect(keys.size).toBe(1);
        expect([...keys][0]).toBe(`${local}@gmail.com`);
      },
    ));
  });

  it('preserves dots on non-gmail domains', () => {
    fc.assert(fc.property(
      fc.stringMatching(/^[a-z]{2,6}$/),
      fc.stringMatching(/^[a-z]{2,6}$/),
      fc.constantFrom('outlook.com', 'yahoo.com', 'example.co.za'),
      (a, b, domain) => {
        expect(normEmail(`${a}.${b}@${domain}`)).toBe(`${a}.${b}@${domain}`);
      },
    ));
  });
});

describe('property: normPhone', () => {
  it('is idempotent', () => {
    fc.assert(fc.property(subscriberArb, (s) => {
      const v = fc.sample(phoneVariantArb(s), 1)[0];
      expect(normPhone(normPhone(v))).toBe(normPhone(v));
    }));
  });

  it('all formatting variants of the same SA number collapse to one key', () => {
    fc.assert(fc.property(subscriberArb, (sub) => {
      const samples = fc.sample(phoneVariantArb(sub), 20);
      const keys = new Set(samples.map((v) => normPhone(v)));
      expect(keys.size).toBe(1);
      expect([...keys][0]).toBe(sub);
    }));
  });

  it('returns at most 9 digits', () => {
    fc.assert(fc.property(subscriberArb, (sub) => {
      const v = fc.sample(phoneVariantArb(sub), 1)[0];
      expect(normPhone(v).length).toBeLessThanOrEqual(9);
    }));
  });

  it('never throws on arbitrary strings', () => {
    fc.assert(fc.property(fc.string(), (s) => {
      expect(() => normPhone(s)).not.toThrow();
    }));
  });
});

describe('property: canonUrl / hostOf', () => {
  const urlArb = fc.webUrl();

  it('canonUrl is idempotent and lowercases', () => {
    fc.assert(fc.property(urlArb, (u) => {
      const c = canonUrl(u);
      expect(canonUrl(c)).toBe(c);
      expect(c).toBe(c.toLowerCase());
      expect(c).not.toMatch(/[?#]/);
    }));
  });

  it('canonUrl ignores query and hash', () => {
    fc.assert(fc.property(urlArb, fc.string(), fc.string(), (u, q, h) => {
      const base = canonUrl(u);
      expect(canonUrl(`${u}?${q}#${h}`)).toBe(base);
    }));
  });

  it('hostOf never throws and strips www', () => {
    fc.assert(fc.property(fc.string(), (s) => {
      expect(() => hostOf(s)).not.toThrow();
      expect(hostOf(s)).not.toMatch(/^www\./);
    }));
  });
});
