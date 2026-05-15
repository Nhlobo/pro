import { describe, it, expect } from 'vitest';
import { isPotentialEntry } from '../pitchlogPotential';

describe('isPotentialEntry', () => {
  it('returns true when identified_challenge is "Potential"', () => {
    expect(isPotentialEntry({ identified_challenge: 'Potential', comment: 'anything' })).toBe(true);
  });

  it('returns true when comment is "Potential"', () => {
    expect(isPotentialEntry({ identified_challenge: 'No Time', comment: 'Potential' })).toBe(true);
  });

  it('returns true when both fields are "Potential"', () => {
    expect(isPotentialEntry({ identified_challenge: 'Potential', comment: 'Potential' })).toBe(true);
  });

  it('returns false when neither field is "Potential"', () => {
    expect(isPotentialEntry({ identified_challenge: 'No Time', comment: 'Call back' })).toBe(false);
  });

  it('excludes "Interested" in identified_challenge', () => {
    expect(isPotentialEntry({ identified_challenge: 'Interested', comment: null })).toBe(false);
  });

  it('excludes "Interested" in comment', () => {
    expect(isPotentialEntry({ identified_challenge: null, comment: 'Interested' })).toBe(false);
  });

  it('excludes "Interested" in both fields', () => {
    expect(isPotentialEntry({ identified_challenge: 'Interested', comment: 'Interested' })).toBe(false);
  });

  it('is case-sensitive — "potential" (lowercase) does not match', () => {
    expect(isPotentialEntry({ identified_challenge: 'potential', comment: 'potential' })).toBe(false);
  });

  it('does not match substrings like "Potential Lead"', () => {
    expect(isPotentialEntry({ identified_challenge: 'Potential Lead', comment: 'High potential' })).toBe(false);
  });

  it('handles null and undefined fields safely', () => {
    expect(isPotentialEntry({ identified_challenge: null, comment: null })).toBe(false);
    expect(isPotentialEntry({})).toBe(false);
  });

  it('filters a mixed list to only "Potential" entries', () => {
    const entries = [
      { identified_challenge: 'Potential', comment: '' },
      { identified_challenge: 'Interested', comment: '' },
      { identified_challenge: '', comment: 'Potential' },
      { identified_challenge: '', comment: 'Interested' },
      { identified_challenge: 'No Time', comment: 'Call back' },
    ];
    expect(entries.filter(isPotentialEntry)).toHaveLength(2);
  });
});
