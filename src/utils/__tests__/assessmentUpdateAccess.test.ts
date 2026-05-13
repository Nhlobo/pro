import { describe, it, expect } from 'vitest';
import {
  isInternalAdminProfile,
  shouldScopeToReferringAttorney,
} from '@/utils/assessmentUpdateAccess';

describe('Assessment Update access — internal staff visibility', () => {
  describe('isInternalAdminProfile', () => {
    it('treats role=admin as internal', () => {
      expect(isInternalAdminProfile({ role: 'admin' })).toBe(true);
    });

    it('treats user_type=employee as internal', () => {
      expect(isInternalAdminProfile({ user_type: 'employee' })).toBe(true);
    });

    it('treats Medico Legal Manager position as internal', () => {
      expect(isInternalAdminProfile({ position: 'Medico Legal Manager' })).toBe(true);
    });

    it('treats Case Manager position as internal', () => {
      expect(isInternalAdminProfile({ position: 'Case Manager' })).toBe(true);
    });

    it('treats external referring attorney as NOT internal', () => {
      expect(
        isInternalAdminProfile({
          role: 'referring_attorney',
          user_type: 'external',
          position: 'Attorney',
        })
      ).toBe(false);
    });

    it('returns false for null/undefined profiles', () => {
      expect(isInternalAdminProfile(null)).toBe(false);
      expect(isInternalAdminProfile(undefined)).toBe(false);
    });
  });

  describe('shouldScopeToReferringAttorney', () => {
    it('NEVER scopes an admin, even when referring_attorney_id is set', () => {
      expect(
        shouldScopeToReferringAttorney({
          role: 'admin',
          referring_attorney_id: 'attn-123',
        })
      ).toBe(false);
    });

    it('NEVER scopes an employee, even when referring_attorney_id is set', () => {
      expect(
        shouldScopeToReferringAttorney({
          user_type: 'employee',
          referring_attorney_id: 'attn-123',
        })
      ).toBe(false);
    });

    it('NEVER scopes Medico Legal Manager (Itebogeng case)', () => {
      expect(
        shouldScopeToReferringAttorney({
          position: 'Medico Legal Manager',
          referring_attorney_id: 'attn-123',
        })
      ).toBe(false);
    });

    it('NEVER scopes Case Manager (Virginia case)', () => {
      expect(
        shouldScopeToReferringAttorney({
          position: 'Case Manager',
          referring_attorney_id: 'attn-123',
        })
      ).toBe(false);
    });

    it('scopes external referring attorneys when referring_attorney_id is set', () => {
      expect(
        shouldScopeToReferringAttorney({
          role: 'referring_attorney',
          user_type: 'external',
          position: 'Attorney',
          referring_attorney_id: 'attn-123',
        })
      ).toBe(true);
    });

    it('does not scope external attorneys without a referring_attorney_id', () => {
      expect(
        shouldScopeToReferringAttorney({
          role: 'referring_attorney',
          referring_attorney_id: null,
        })
      ).toBe(false);
    });
  });
});
